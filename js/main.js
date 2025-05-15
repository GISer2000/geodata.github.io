// 灰色底图（WGS84）
const esriGrayBasemap = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attributions: 'Tiles © Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16
  })
});

// 初始化地图
const map = new ol.Map({
  target: 'map',
  layers: [esriGrayBasemap],
  view: new ol.View({
    center: ol.proj.fromLonLat([104.0, 35.0]),
    zoom: 4
  })
});

// 样式缓存
const defaultPointStyle = new ol.style.Style({
  image: new ol.style.Circle({
    radius: 0.5,
    fill: new ol.style.Fill({ color: 'rgba(0, 123, 255, 0.6)' }),
    stroke: new ol.style.Stroke({ color: '#007bff', width: 1 })
  })
});

const highlightStyle = new ol.style.Style({
  image: new ol.style.Circle({
    radius: 1,
    fill: new ol.style.Fill({ color: 'rgba(255, 0, 0, 0.8)' }),
    stroke: new ol.style.Stroke({ color: 'red', width: 2 })
  })
});

let vectorLayer;
let allFeatures = [];
let lastHighlightedFeatures = [];
const cityIndex = {};

// 加载 GeoJSON 数据
fetch('data/dataset.geojson')
  .then(res => res.json())
  .then(data => {
    const vectorSource = new ol.source.Vector({
      features: new ol.format.GeoJSON().readFeatures(data, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      })
    });

    allFeatures = vectorSource.getFeatures();

    // 建立城市索引
    allFeatures.forEach(f => {
      const city = f.get('City');
      if (!cityIndex[city]) cityIndex[city] = [];
      cityIndex[city].push(f);
    });

    // 总签到数
    const totalCount = allFeatures.reduce((sum, f) => sum + (f.get('Count') || 1), 0);
    document.getElementById('totalPoints').textContent = `总签到数：${totalCount}`;

    vectorLayer = new ol.layer.Vector({
      source: vectorSource,
      style: () => defaultPointStyle,
      renderBuffer: 50,
      updateWhileAnimating: false,
      updateWhileInteracting: false
    });

    map.addLayer(vectorLayer);
  });

// 城市列表
const cities = ['北京市', '上海市', '苏州市', '深圳市', '郑州市'];

// 初始化城市下拉菜单
function initCitySelector() {
  const selector = document.getElementById('citySelector');

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '请选择城市';
  selector.appendChild(defaultOption);

  cities.forEach(city => {
    const option = document.createElement('option');
    option.value = city;
    option.textContent = city;
    selector.appendChild(option);
  });

  selector.addEventListener('change', () => {
    const cityName = selector.value;
    searchFeature(cityName);

    document.getElementById('currentCity').textContent = `当前城市：${cityName || '--'}`;

    if (cityName && cityIndex[cityName]) {
      const cityFeatures = cityIndex[cityName];
      const cityCount = cityFeatures.reduce((sum, f) => sum + (f.get('Count') || 1), 0);
      document.getElementById('cityPoints').textContent = `城市签到数：${cityCount}`;
    } else {
      document.getElementById('cityPoints').textContent = `城市签到数：--`;
    }
  });
}

// 高亮城市要素
function searchFeature(cityName) {
  if (!vectorLayer) return;

  // 清除上一次高亮样式
  lastHighlightedFeatures.forEach(f => f.setStyle(null));
  lastHighlightedFeatures = [];

  if (!cityName || !cityIndex[cityName]) return;

  const matchedFeatures = cityIndex[cityName];

  // 设置高亮样式
  matchedFeatures.forEach(f => f.setStyle(highlightStyle));
  lastHighlightedFeatures = matchedFeatures;

  // 缩放视图
  if (matchedFeatures.length > 0) {
    const extent = ol.extent.createEmpty();
    matchedFeatures.forEach(f => {
      ol.extent.extend(extent, f.getGeometry().getExtent());
    });

    map.getView().fit(extent, {
      duration: 600,  // 减少动画时间
      maxZoom: 10,
      padding: [50, 50, 50, 50]
    });
  }
}

// 重置地图
function resetMap() {
  document.getElementById('citySelector').value = '';
  searchFeature('');
  map.getView().setCenter(ol.proj.fromLonLat([104.0, 35.0]));
  map.getView().setZoom(4);

  document.getElementById('currentCity').textContent = `当前城市：--`;
  document.getElementById('cityPoints').textContent = `城市签到数：--`;
}

// 页面加载后初始化
document.addEventListener('DOMContentLoaded', () => {
  initCitySelector();

  const resetButton = document.createElement('button');
  resetButton.textContent = '重置视图';
  resetButton.className = 'btn btn-secondary';
  resetButton.style.marginTop = '10px';
  resetButton.onclick = resetMap;
  document.querySelector('.sidebar').appendChild(resetButton);
});