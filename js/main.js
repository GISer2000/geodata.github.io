// 使用 ArcGIS 灰度底图（Light Gray Base）- 配置为 WGS84 投影
const esriGrayBasemap = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attributions: 'Tiles © Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16
  }),
  // projection: 'EPSG:4326' // 设置底图投影为 WGS84
});

// 初始化地图：全国范围，中心在中国地理中心点（使用 WGS84 坐标）
const map = new ol.Map({
  target: 'map',
  layers: [esriGrayBasemap],
  view: new ol.View({
    center: ol.proj.fromLonLat([104.0, 35.0]), // 中国大致中心点
    zoom: 4, // 缩放级别适合全国视图
    // projection: 'EPSG:4326' // 设置地图视图投影为 WGS84
  })
});

// 加载 GeoJSON 数据（保持 WGS84 坐标）
let vectorLayer;
let allFeatures = [];

fetch('data/dataset.geojson')
  .then(res => res.json())
  .then(data => {
    const vectorSource = new ol.source.Vector({
      features: new ol.format.GeoJSON().readFeatures(data, {
        dataProjection: 'EPSG:4326', // 数据是 WGS84 坐标
        featureProjection: 'EPSG:3857' // 直接使用 WGS84 坐标，无需转换
      })
    });

    // 保存所有要素引用
    allFeatures = vectorSource.getFeatures();
    
    // 计算总签到点数量（使用大写的 "Count" 字段）
    const totalCount = allFeatures.reduce((sum, feature) => {
      return sum + (feature.get('Count') || 1);
    }, 0);
    
    // 更新统计信息
    document.getElementById('totalPoints').textContent = `总签到点：${totalCount}`;

    // 默认样式函数（使用大写的 "Count" 字段）
    const defaultStyle = feature => {
      const count = feature.get('Count') || 1;
      const radius = Math.max(5, Math.sqrt(count) * 2);
      
      return new ol.style.Style({
        image: new ol.style.Circle({
          radius: radius,
          fill: new ol.style.Fill({ color: 'rgba(0, 123, 255, 0.6)' }),
          stroke: new ol.style.Stroke({ color: '#007bff', width: 1 })
        }),
        text: new ol.style.Text({
          text: '', // 默认不显示标签，减少视觉干扰
          font: '12px Arial',
          fill: new ol.style.Fill({ color: '#333' }),
          offsetY: -15,
          textAlign: 'center'
        })
      });
    };

    vectorLayer = new ol.layer.Vector({
      source: vectorSource,
      style: defaultStyle
    });

    map.addLayer(vectorLayer);
  });

// 预设的城市列表（按拼音首字母排序）
const cities = ['北京市', '广州市', '上海市', '深圳市', '郑州市'];

// 初始化城市选择下拉菜单
function initCitySelector() {
  const selector = document.getElementById('citySelector');
  
  // 添加默认选项
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '请选择城市';
  selector.appendChild(defaultOption);
  
  // 添加城市选项
  cities.forEach(city => {
    const option = document.createElement('option');
    option.value = city;
    option.textContent = city;
    selector.appendChild(option);
  });
  
  // 添加选择事件监听
  selector.addEventListener('change', () => {
    const cityName = selector.value;
    searchFeature(cityName);
    
    // 更新当前城市统计信息（使用大写的 "City" 字段）
    document.getElementById('currentCity').textContent = `当前城市：${cityName || '--'}`;
    
    if (cityName) {
      const cityFeatures = allFeatures.filter(f => f.get('City') === cityName);
      const cityCount = cityFeatures.reduce((sum, feature) => {
        return sum + (feature.get('Count') || 1);
      }, 0);
      document.getElementById('cityPoints').textContent = `城市签到数：${cityCount}`;
    } else {
      document.getElementById('cityPoints').textContent = `城市签到数：--`;
    }
  });
}

// 城市查询功能（基于大写的 "City" 字段）
function searchFeature(cityName) {
  if (!vectorLayer) return;

  // 重置所有要素样式为默认样式
  allFeatures.forEach(f => {
    f.setStyle(null); // null 会应用图层的默认样式
  });

  // 如果没有选择城市（重置状态），则不执行缩放
  if (!cityName) return;

  // 使用大写的 "City" 字段进行过滤
  const matchedFeatures = allFeatures.filter(f => f.get('City') === cityName);
  
  // 为匹配的要素设置高亮样式
  matchedFeatures.forEach(f => {
    f.setStyle(new ol.style.Style({
      image: new ol.style.Circle({
        radius: 10,
        fill: new ol.style.Fill({ color: 'rgba(255, 0, 0, 0.8)' }),
        stroke: new ol.style.Stroke({ color: 'red', width: 2 })
      }),
      text: new ol.style.Text({
        text: `${f.get('City')} (${f.get('Count') || 0})`,
        font: '14px Arial bold',
        fill: new ol.style.Fill({ color: 'red' }),
        offsetY: -18,
        textAlign: 'center'
      })
    }));
  });

  // 如果找到匹配项，调整视图以显示所有匹配点
  if (matchedFeatures.length > 0) {
    const extent = ol.extent.createEmpty();
    matchedFeatures.forEach(f => {
      ol.extent.extend(extent, f.getGeometry().getExtent());
    });
    
    // 确保视图有足够的空间显示所有点
    ol.extent.buffer(extent, 0.5); // 缓冲距离需要根据 WGS84 坐标单位（度）调整
    
    // 平滑动画到匹配区域
    map.getView().fit(extent, {
      duration: 1500,
      maxZoom: 10,
      padding: [50, 50, 50, 50] // 增加边距，确保点不会太靠近边缘
    });
  }
}

// 重置地图视图和选择
function resetMap() {
  document.getElementById('citySelector').value = '';
  searchFeature('');
  map.getView().setCenter(ol.proj.fromLonLat([104.0, 35.0]));
  map.getView().setZoom(4);
  
  // 更新统计信息
  document.getElementById('currentCity').textContent = `当前城市：--`;
  document.getElementById('cityPoints').textContent = `城市签到数：--`;
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  initCitySelector();
  
  // 添加重置按钮
  const resetButton = document.createElement('button');
  resetButton.textContent = '重置视图';
  resetButton.className = 'btn btn-secondary';
  resetButton.style.marginTop = '10px';
  resetButton.onclick = resetMap;
  document.querySelector('.sidebar').appendChild(resetButton);
});