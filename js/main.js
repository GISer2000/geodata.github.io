// 使用 ArcGIS 灰度底图（Light Gray Base）
const esriGrayBasemap = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attributions: 'Tiles © Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16
  })
});

// 初始化地图：全国范围，中心在中国地理中心点
const map = new ol.Map({
  target: 'map',
  layers: [esriGrayBasemap],
  view: new ol.View({
    center: ol.proj.fromLonLat([104.0, 35.0]), // 中国大致中心点
    zoom: 4 // 缩放级别适合全国视图
  })
});

// 加载 GeoJSON 数据
let vectorLayer;
fetch('data/dataset.geojson')
  .then(res => res.json())
  .then(data => {
    const vectorSource = new ol.source.Vector({
      features: new ol.format.GeoJSON().readFeatures(data, {
        featureProjection: 'EPSG:4326'
      })
    });

    vectorLayer = new ol.layer.Vector({
      source: vectorSource,
      style: new ol.style.Style({
        fill: new ol.style.Fill({ color: 'rgba(0, 123, 255, 0.4)' }),
        stroke: new ol.style.Stroke({ color: '#007bff', width: 2 })
      })
    });

    map.addLayer(vectorLayer);
  });

// 属性查询功能（基于 'name' 字段）
function searchFeature() {
  const keyword = document.getElementById('query').value.toLowerCase();
  if (!vectorLayer) return;

  const features = vectorLayer.getSource().getFeatures();
  features.forEach(f => {
    const name = f.get('name')?.toLowerCase();
    const match = name && name.includes(keyword);

    f.setStyle(match
      ? new ol.style.Style({
          stroke: new ol.style.Stroke({ color: 'red', width: 3 }),
          fill: new ol.style.Fill({ color: 'rgba(255,0,0,0.3)' })
        })
      : null // 恢复默认样式
    );
  });
}
