// 地图图层设置
const map = new ol.Map({
  target: 'map',
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM(),
    })
  ],
  view: new ol.View({
    center: ol.proj.fromLonLat([104.06, 30.67]), // 成都为例
    zoom: 12
  })
});

// 加载 GeoJSON 数据
let vectorLayer;
fetch('data/dataset.geojson')
  .then(res => res.json())
  .then(data => {
    const vectorSource = new ol.source.Vector({
      features: new ol.format.GeoJSON().readFeatures(data, {
        featureProjection: 'EPSG:3857'
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

// 属性查询功能
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
      : null // 还原默认样式
    );
  });
}
