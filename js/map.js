// ------------------ 地图初始化 ------------------
const map = new ol.Map({
    target: 'map', 
    layers: [
        new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
                attributions: 'Tiles &copy; Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN'
            })
        })
    ],
    view: new ol.View({
        center: ol.proj.fromLonLat([104.07, 30.67]), 
        zoom: 3,
        projection: 'EPSG:3857'
    })
});

// ------------------ 中国边界默认样式 ------------------
const defaultChinaLayerStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: 'rgba(123, 123, 201, 0.8)',
        width: 1
    }),
    fill: new ol.style.Fill({
        color: 'rgba(255, 255, 255, 0)'
    })
});

const chinaVectorSource = new ol.source.Vector({
    format: new ol.format.GeoJSON(),
    url: 'data/geodata/china.geojson'
});

const chinaVectorLayer = new ol.layer.Vector({
    source: chinaVectorSource,
    style: defaultChinaLayerStyle
});

map.addLayer(chinaVectorLayer);

chinaVectorSource.on('addfeature', function() {
    const extent = chinaVectorSource.getExtent();
    map.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 1000
    });
});

// ------------------ DOM 元素 ------------------
const dataTypeSelect = document.getElementById('dataType');
const citySelect = document.getElementById('citySelect');
const refreshMapButton = document.getElementById('refreshMap');
const dataDescriptionParagraph = document.getElementById('dataDescription');
const resetMapButton = document.getElementById('resetMap');

let currentGeoJSONLayer = null;
let allData = [];
let odNumBreaks = [];

const DATA_FOLDER_MAP = {
    'AOI': 'aoi',
    'OD流': 'od',
    'POI': 'poi',
    '建筑足迹': 'building',
    '移动轨迹': 'trajectory',
    '微博签到': 'weibo',
    '其他门类': 'other'
};

// ------------------ 分级计算函数 ------------------
function calculateQuantileBreaks(dataValues, numBreaks) {
    if (!dataValues || dataValues.length === 0) return [];
    const validValues = dataValues.filter(v => typeof v === 'number' && !isNaN(v));
    if (validValues.length === 0) return [];
    const sortedValues = [...validValues].sort((a, b) => a - b);
    const breaks = [];
    for (let i = 1; i < numBreaks; i++) {
        const index = Math.min(Math.floor(sortedValues.length * i / numBreaks), sortedValues.length - 1);
        breaks.push(sortedValues[index]);
    }
    if (sortedValues.length > 0) breaks.push(sortedValues[sortedValues.length - 1]);
    return [...new Set(breaks)].sort((a, b) => a - b);
}

function calculateNaturalBreaks(dataValues, numBreaks) {
    if (!dataValues || dataValues.length === 0) return [];
    const validValues = dataValues.filter(v => typeof v === 'number' && !isNaN(v));
    if (validValues.length === 0) return [];

    try {
        const clusters = ss.ckmeans(validValues, numBreaks);
        let jenksBreaks = clusters.map(cluster => cluster[cluster.length - 1]);
        let uniqueBreaks = [...new Set(jenksBreaks)].sort((a, b) => a - b);
        if (validValues.length > 0 && uniqueBreaks.length > 0 && uniqueBreaks[uniqueBreaks.length - 1] < Math.max(...validValues))
             uniqueBreaks.push(Math.max(...validValues));
        if (uniqueBreaks.length < numBreaks) return calculateQuantileBreaks(validValues, numBreaks);
        return uniqueBreaks.slice(0, numBreaks);
    } catch (e) {
        console.error("Error calculating natural breaks, fallback to quantile:", e);
        return calculateQuantileBreaks(validValues, numBreaks);
    }
}

function getChoroplethColor(value, breaks, colors) {
    if (value === undefined || value === null || isNaN(value)) return 'rgba(0,0,0,0)';
    for (let i = 0; i < breaks.length; i++) {
        if (value <= breaks[i]) return colors[i];
    }
    return colors[colors.length - 1];
}

// ------------------ 通用省份分级加载 ------------------
async function fetchProvinceCountsGeneric(dataType, fileName, colorScheme) {
    const folder = DATA_FOLDER_MAP[dataType] || dataType.toLowerCase();
    const filePath = `data/geodata/${folder}/${fileName}`;
    let counts = {};

    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            console.warn(`未找到省份统计文件: ${filePath}`);
            return { counts: {}, breaks: [] };
        }
        counts = await response.json();
    } catch (err) {
        console.error(`加载 ${filePath} 出错:`, err);
        return { counts: {}, breaks: [] };
    }

    const provinceFeatures = chinaVectorSource.getFeatures();
    const allProvinceNames = new Set(provinceFeatures.map(f => f.get('fullname')));
    allProvinceNames.forEach(name => {
        if (counts[name] === undefined) counts[name] = 0;
    });

    const values = Object.values(counts).filter(v => typeof v === 'number' && v > 0);
    const numBreaks = colorScheme.length;
    let breaks = calculateNaturalBreaks(values, numBreaks);
    if (breaks.length === 0 && values.length > 0) breaks.push(Math.max(...values));

    return { counts, breaks };
}

// ------------------ 数据下拉菜单 ------------------
function populateDataTypeDropdown() {
    dataTypeSelect.innerHTML = '';
    allData.forEach(item => {
        const option = document.createElement('option');
        option.value = item.type;
        option.textContent = item.type;
        dataTypeSelect.appendChild(option);
    });
    populateCityDropdown();
}

function populateCityDropdown() {
    citySelect.innerHTML = '';
    const selectedDataType = dataTypeSelect.value;
    const selectedDataItem = allData.find(item => item.type === selectedDataType);

    if (selectedDataItem && selectedDataItem.title) {
        selectedDataItem.title.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });
    }
}

function updateDescription() {
    const selectedDataType = dataTypeSelect.value;
    const selectedDataItem = allData.find(item => item.type === selectedDataType);
    dataDescriptionParagraph.textContent = selectedDataItem?.description || '此数据类型无可用描述。';
}

// ------------------ 加载 GeoJSON 数据 ------------------
async function loadGeoJSONData(dataType, city) {
    chinaVectorLayer.setStyle(defaultChinaLayerStyle);
    if (currentGeoJSONLayer) {
        map.removeLayer(currentGeoJSONLayer);
        currentGeoJSONLayer = null;
    }

    if (!dataType || !city) return;

    // ------------------ 全国级数据分省显示 ------------------
    if (city.startsWith('全国(')) {
        const folderMap = {
            'POI': 'poi',
            '建筑足迹': 'building',
            '其他门类': 'other'
        };
        const folder = folderMap[dataType] || dataType.toLowerCase();
        const fileName = `${city}.json`;

        const COLOR_MAP = {
            'POI': ['#f7fbff','#deebf7','#c6dbef','#9ecae1','#6baed6','#3182bd','#08519c'],
            '建筑足迹': ['#fff5f0','#fee0d2','#fcbba1','#fc9272','#fb6a4a','#de2d26','#a50f15'],
            '其他门类': ['#f7f7f7','#e0e0e0','#c9c9c9','#b0b0b0','#969696','#7d7d7d','#525252'],
            '默认': ['#edf8e9','#bae4b3','#74c476','#31a354','#006d2c']
        };
        const colorScheme = COLOR_MAP[dataType] || COLOR_MAP['默认'];

        const { counts, breaks } = await fetchProvinceCountsGeneric(folder, fileName, colorScheme);

        if (!counts || Object.keys(counts).length === 0) {
            dataDescriptionParagraph.textContent = `${dataType} 全国数据不可用`;
            return;
        }

        chinaVectorLayer.setStyle(function(feature) {
            const provinceName = feature.get('fullname');
            const count = counts[provinceName] || 0;
            const color = getChoroplethColor(count, breaks, colorScheme);

            const styles = [new ol.style.Style({
                fill: new ol.style.Fill({ color }),
                stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,0.5)', width: 0.8 })
            })];

            if (feature.getGeometry()?.getType().includes('Polygon')) {
                const centroid = ol.extent.getCenter(feature.getGeometry().getExtent());
                styles.push(new ol.style.Style({
                    geometry: new ol.geom.Point(centroid),
                    text: new ol.style.Text({
                        text: count.toString(),
                        font: '10px Calibri,sans-serif',
                        fill: new ol.style.Fill({ color: '#000' }),
                        stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
                    })
                }));
            }

            return styles;
        });

        map.getView().fit(chinaVectorSource.getExtent(), { padding: [50,50,50,50], duration: 1000 });
        console.log(`✅ 已显示 ${city} 的 ${dataType} 全国分级统计图`);
        return;
    }

    // ------------------ 其他点/线/面类型 ------------------
    let geoJSONBasePath = 'data/geodata/';
    let specificFolder = '';
    let layerStyle = null;

    switch (dataType) {
        case 'AOI': specificFolder = 'aoi'; layerStyle = new ol.style.Style({fill: new ol.style.Fill({color:'rgba(100,149,237,0.4)'}), stroke: new ol.style.Stroke({color:'rgba(65,105,225,0.8)', width:2})}); break;
        case 'OD流': specificFolder = 'od'; layerStyle = (f)=>{const num=f.get('num');const color=getChoroplethColor(num, odNumBreaks,['#fee0d2','#fc9272','#fb6a4a','#de2d26','#a50f15']);const w=[1,2,3,4,5][['#fee0d2','#fc9272','#fb6a4a','#de2d26','#a50f15'].indexOf(color)]; return new ol.style.Style({stroke:new ol.style.Stroke({color,width:w})});}; break;
        case 'POI': specificFolder = 'poi'; layerStyle = new ol.style.Style({image:new ol.style.Circle({radius:7, fill:new ol.style.Fill({color:'rgba(0,128,0,0.7)'}), stroke:new ol.style.Stroke({color:'rgba(0,100,0,1)', width:1})})}); break;
        case '微博签到': specificFolder = 'weibo'; layerStyle = new ol.style.Style({image:new ol.style.Circle({radius:5, fill:new ol.style.Fill({color:'rgba(255,99,132,0.7)'}), stroke:new ol.style.Stroke({color:'rgba(255,0,0,1)', width:1})})}); break;
        case '移动轨迹': specificFolder = 'trajectory'; layerStyle = new ol.style.Style({stroke:new ol.style.Stroke({color:'rgba(1,43,82,0.93)', width:3})}); break;
        default: specificFolder = dataType.toLowerCase(); layerStyle = new ol.style.Style({fill:new ol.style.Fill({color:'rgba(255,0,0,0.3)'}), stroke:new ol.style.Stroke({color:'rgba(255,0,0,0.8)', width:2})});
    }

    const geoJSONFilePath = `${geoJSONBasePath}${specificFolder}/${city}.geojson`;
    const newVectorSource = new ol.source.Vector({format: new ol.format.GeoJSON(), url: geoJSONFilePath});
    const newVectorLayer = new ol.layer.Vector({source: newVectorSource, style: layerStyle});
    map.addLayer(newVectorLayer);
    currentGeoJSONLayer = newVectorLayer;

    newVectorSource.once('change', function() {
        if (newVectorSource.getState() === 'ready') {
            if (dataType === 'OD流') {
                const features = newVectorSource.getFeatures();
                const numValues = features.map(f=>f.get('num')).filter(v=>typeof v==='number'&&!isNaN(v));
                odNumBreaks = calculateNaturalBreaks(numValues, 5);
                newVectorLayer.setStyle(layerStyle);
            }
            map.getView().fit(newVectorSource.getExtent(), {padding:[50,50,50,50], duration:1000});
        }
    });

    newVectorSource.on('error', function(e){
        console.error('加载 GeoJSON 出错:', geoJSONFilePath, e);
        dataDescriptionParagraph.textContent = `加载 ${city} 空间数据出错`;
    });
}

// ------------------ 更新地图 ------------------
function updateMapAndDescription() {
    updateDescription();
    loadGeoJSONData(dataTypeSelect.value, citySelect.value);
}

// ------------------ 重置地图 ------------------
function resetMap() {
    if (currentGeoJSONLayer) map.removeLayer(currentGeoJSONLayer);
    currentGeoJSONLayer = null;
    chinaVectorLayer.setStyle(defaultChinaLayerStyle);
    map.getView().fit(chinaVectorSource.getExtent(), {padding:[50,50,50,50], duration:1000});
    if (dataTypeSelect.options.length>0) {dataTypeSelect.selectedIndex=0; populateCityDropdown();}
    if (citySelect.options.length>0) citySelect.selectedIndex=0;
    dataDescriptionParagraph.textContent='';
}

// ------------------ 事件绑定 ------------------
dataTypeSelect.addEventListener('change', populateCityDropdown);
refreshMapButton.addEventListener('click', updateMapAndDescription);
resetMapButton.addEventListener('click', resetMap);

// ------------------ 初始数据加载 ------------------
async function fetchAllData() {
    try {
        const res = await fetch('data/describe/all.json');
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        allData = await res.json();
        populateDataTypeDropdown();
    } catch(e){
        console.error('加载 all.json 出错:', e);
        dataDescriptionParagraph.textContent='数据加载错误';
    }
}
fetchAllData();
