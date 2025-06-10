// OpenLayers 地图初始化，使用 ArcGIS 底图
const map = new ol.Map({
    target: 'map', // 地图容器 div 元素的 ID
    layers: [
        new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
                attributions: 'Tiles &copy; Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN'
            })
        })
    ],
    view: new ol.View({
        center: ol.proj.fromLonLat([104.07, 30.67]), // 将地图中心设置到中国成都（经度，纬度）
        zoom: 3,
        projection: 'EPSG:3857' // 统一投影：Web Mercator
    })
});

// 中国边界的默认样式（透明填充，蓝色边框）
const defaultChinaLayerStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: 'rgba(123, 123, 201, 0.8)', // 带有透明度的蓝色边框
        width: 1
    }),
    fill: new ol.style.Fill({
        color: 'rgba(255, 255, 255, 0)' // 完全透明的填充
    })
});

// 为 GeoJSON 数据创建矢量源（最初用于中国边界）
const chinaVectorSource = new ol.source.Vector({
    format: new ol.format.GeoJSON(),
    url: 'data/geodata/china.geojson' // china.geojson 文件的路径
});

// 为 GeoJSON 数据创建矢量图层（最初用于中国边界）
const chinaVectorLayer = new ol.layer.Vector({
    source: chinaVectorSource,
    style: defaultChinaLayerStyle // 应用默认样式
});

// 将矢量图层添加到地图
map.addLayer(chinaVectorLayer);

// GeoJSON 要素加载完成后，将地图视图调整到其范围
chinaVectorSource.on('addfeature', function() {
    const extent = chinaVectorSource.getExtent();
    map.getView().fit(extent, {
        padding: [50, 50, 50, 50], // 在范围周围添加一些边距
        duration: 1000 // 流畅的动画效果
    });
});

// --- 动态数据加载和下拉菜单填充 ---

const dataTypeSelect = document.getElementById('dataType');
const citySelect = document.getElementById('citySelect');
const refreshMapButton = document.getElementById('refreshMap');
const dataDescriptionParagraph = document.getElementById('dataDescription');
const resetMapButton = document.getElementById('resetMap'); // 重置地图按钮的引用


let allData = []; // 存储从 all.json 获取的数据
let poiProvinceCounts = {}; // 存储按省份统计的 POI 数量，用于分级统计图
let currentGeoJSONLayer = null; // 跟踪当前显示的 GeoJSON 图层

// --- POI 分级统计图样式配置 ---
// POI 分级统计图的 5 级顺序绿蓝色方案
const POI_CHOROPLETH_COLORS = ['#edf8e9', '#bae4b3', '#7bccc4', '#43a2ca', '#0868ac'];
const POI_CHOROPLETH_BREAKS = []; // 将根据数据动态计算

// --- OD流 5级分级颜色和宽度配置 ---
// 红色的5级渐变，用于OD流的num值分级
const OD_FIVE_CLASS_COLORS = ['#fee0d2', '#fc9272', '#fb6a4a', '#de2d26', '#a50f15'];
// 对应的宽度， num值越大线越粗
const OD_FIVE_CLASS_WIDTHS = [1, 2, 3, 4, 5];

let odNumBreaks = []; // 用于存储OD流的num值分级点 (Jenks Natural Breaks)

// 计算分位数分级点函数（备用方案）
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
    // 确保包含最大值作为最后一个分界点
    if (sortedValues.length > 0) {
        breaks.push(sortedValues[sortedValues.length - 1]);
    }
    return [...new Set(breaks)].sort((a, b) => a - b);
}

// 计算自然间断分级点函数（使用 simple-statistics）
function calculateNaturalBreaks(dataValues, numBreaks) {
    if (!dataValues || dataValues.length === 0) return [];
    const validValues = dataValues.filter(v => typeof v === 'number' && !isNaN(v));
    if (validValues.length === 0) return [];

    try {
        // ss.ckmeans 是 simple-statistics 提供的 Jenks natural breaks 实现
        // 它返回的是一个包含 numBreaks 个数组的数组，每个子数组是一个聚类
        // 我们需要每个聚类的最大值作为分界点
        const clusters = ss.ckmeans(validValues, numBreaks);
        const jenksBreaks = clusters.map(cluster => cluster[cluster.length - 1]);

        // 确保返回的 breaks 是递增且唯一的
        let uniqueBreaks = [...new Set(jenksBreaks)].sort((a, b) => a - b);

        // 有时 ckmeans 可能因为数据分布返回的分界点数量不足
        // 确保最后一个分界点是数据中的最大值，并且分界点数量至少和 numBreaks 相同（如果可能）
        if (validValues.length > 0 && uniqueBreaks.length > 0 && uniqueBreaks[uniqueBreaks.length - 1] < Math.max(...validValues)) {
             uniqueBreaks.push(Math.max(...validValues));
        }

        // 如果最终的分界点数量不足，回退到分位数分级
        if (uniqueBreaks.length < numBreaks) {
            console.warn(`Not enough unique values or clusters for ${numBreaks} natural breaks. Falling back to quantile breaks.`);
            return calculateQuantileBreaks(validValues, numBreaks);
        }
        return uniqueBreaks.slice(0, numBreaks); // 返回 numBreaks 个分界点
    } catch (e) {
        console.error("Error calculating natural breaks, falling back to quantile breaks:", e);
        // 出现错误时回退到分位数分级
        return calculateQuantileBreaks(validValues, numBreaks);
    }
}


// 根据值和分级点获取颜色函数
function getChoroplethColor(value, breaks, colors) {
    if (value === undefined || value === null || isNaN(value)) return 'rgba(0,0,0,0)'; // 默认透明
    for (let i = 0; i < breaks.length; i++) {
        if (value <= breaks[i]) {
            return colors[i];
        }
    }
    // 如果值大于所有分界点，使用最后一个颜色
    return colors[colors.length - 1];
}

// 从 all.json 获取数据函数
async function fetchAllData() {
    try {
        const response = await fetch('data/describe/all.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allData = await response.json();
        populateDataTypeDropdown();
    } catch (error) {
        console.error('Error fetching all.json:', error);
        dataDescriptionParagraph.textContent = '数据加载错误。请稍后重试。';
    }
}

// 获取特定年份的 POI 省份统计数据函数
async function fetchPoiProvinceCounts(year) {
    const statsFilePath = `data/geodata/poi/全国(${year}).json`;
    try {
        const response = await fetch(statsFilePath);
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`POI 省份统计文件未找到: ${statsFilePath}。将计数初始化为 0。`);
                poiProvinceCounts = {};
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } else {
            poiProvinceCounts = await response.json();
        }

        const provinceFeatures = chinaVectorSource.getFeatures();
        const allProvinceNames = new Set(provinceFeatures.map(f => f.get('fullname')));

        allProvinceNames.forEach(name => {
            if (poiProvinceCounts[name] === undefined) {
                poiProvinceCounts[name] = 0;
            }
        });

        const counts = Object.values(poiProvinceCounts).filter(v => v > 0);
        const numBreaks = POI_CHOROPLETH_COLORS.length;
        POI_CHOROPLETH_BREAKS.length = 0;
        // POI 分级统计图默认使用分位数分级
        POI_CHOROPLETH_BREAKS.push(...calculateQuantileBreaks(counts, numBreaks));

        if (POI_CHOROPLETH_BREAKS.length === 0 && counts.length > 0) {
            POI_CHOROPLETH_BREAKS.push(Math.max(...counts));
        }

        console.log(`已获取/处理 ${year} 年的 POI 省份计数:`, poiProvinceCounts);
        console.log('POI 分级统计图分级点:', POI_CHOROPLETH_BREAKS);

    } catch (error) {
        console.error(`获取或处理 ${statsFilePath} 时出错:`, error);
        dataDescriptionParagraph.textContent = `加载 ${year} 年的 POI 省份统计数据时出错。`;
        poiProvinceCounts = {};
        POI_CHOROPLETH_BREAKS.length = 0;
    }
}

// 填充数据类型下拉菜单函数
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

// 根据选定的数据类型填充城市下拉菜单函数
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

// 更新描述段落函数
function updateDescription() {
    const selectedDataType = dataTypeSelect.value;
    const selectedDataItem = allData.find(item => item.type === selectedDataType);
    if (selectedDataItem && selectedDataItem.description) {
        dataDescriptionParagraph.textContent = selectedDataItem.description;
    } else {
        dataDescriptionParagraph.textContent = '此数据类型无可用描述。';
    }
}


// 在地图上加载和显示 GeoJSON 数据函数
async function loadGeoJSONData(dataType, city) {
    // 始终首先重置 chinaVectorLayer 样式
    chinaVectorLayer.setStyle(defaultChinaLayerStyle);
    // 移除任何现有的特定 GeoJSON 图层（点、线、面）
    if (currentGeoJSONLayer) {
        map.removeLayer(currentGeoJSONLayer);
        currentGeoJSONLayer = null;
    }

    if (!dataType || !city) {
        console.warn("未选择数据类型或城市。无法加载 GeoJSON。");
        return;
    }

    // --- POI 省份分级统计图的特殊处理 ---
    if (dataType === 'POI' && city.startsWith('全国(')) {
        const yearMatch = city.match(/\((\d{4})\)/);
        const year = yearMatch ? yearMatch[1] : null;

        if (!year) {
            dataDescriptionParagraph.textContent = "错误：无法从 POI 数据选择中提取年份。";
            return;
        }

        await fetchPoiProvinceCounts(year);

        if (Object.keys(poiProvinceCounts).length === 0 && POI_CHOROPLETH_BREAKS.length === 0) {
            dataDescriptionParagraph.textContent = `POI 省份数据 (${year} 年) 不可用或加载不正确。`;
            return;
        }

        chinaVectorLayer.setStyle(function(feature) {
            const provinceName = feature.get('fullname');
            const count = poiProvinceCounts[provinceName] || 0;
            const color = getChoroplethColor(count, POI_CHOROPLETH_BREAKS, POI_CHOROPLETH_COLORS);

            const styles = [
                new ol.style.Style({
                    fill: new ol.style.Fill({
                        color: color
                    }),
                    stroke: new ol.style.Stroke({
                        color: 'rgba(0, 0, 0, 0.5)',
                        width: 0.8
                    })
                })
            ];

            // 为每个省份添加数字标签（如果要素是面）
            if (feature.getGeometry() && feature.getGeometry().getType().includes('Polygon')) {
                const centroid = ol.extent.getCenter(feature.getGeometry().getExtent());
                styles.push(
                    new ol.style.Style({
                        geometry: new ol.geom.Point(centroid),
                        text: new ol.style.Text({
                            text: count.toString(),
                            font: '10px Calibri,sans-serif',
                            fill: new ol.style.Fill({ color: '#000' }),
                            stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
                        })
                    })
                );
            }
            return styles;
        });

        const extent = chinaVectorSource.getExtent();
        map.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 1000
        });

        console.log(`已显示 ${city} 的 POI 分级统计图`);
        return;
    }

    // --- 其他 GeoJSON 类型（点、线、自定义多边形）的通用处理 ---
    let geoJSONBasePath = 'data/geodata/';
    let specificFolder = '';
    let layerStyle = null; // 用于存储当前图层的样式

    switch (dataType) {
        case 'AOI':
            specificFolder = 'aoi';
            layerStyle = new ol.style.Style({
                fill: new ol.style.Fill({
                    color: 'rgba(100, 149, 237, 0.4)'
                }),
                stroke: new ol.style.Stroke({
                    color: 'rgba(65, 105, 225, 0.8)',
                    width: 2
                })
            });
            break;
        case 'OD流':
            specificFolder = 'od';
            // OD流的样式将动态生成，依赖于数据加载完成后的num值统计
            layerStyle = (feature) => {
                const num = feature.get('num');
                // 使用 odNumBreaks 进行颜色分级
                const color = getChoroplethColor(num, odNumBreaks, OD_FIVE_CLASS_COLORS);
                // 宽度也根据颜色索引来
                const widthIndex = OD_FIVE_CLASS_COLORS.findIndex(c => c === color);
                const width = OD_FIVE_CLASS_WIDTHS[widthIndex !== -1 ? widthIndex : 0]; // 找不到则默认最小宽度

                return new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: color,
                        width: width
                    }),
                });
            };
            break;
        case 'POI':
            specificFolder = 'poi';
            layerStyle = new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 7,
                    fill: new ol.style.Fill({
                        color: 'rgba(0, 128, 0, 0.7)'
                    }),
                    stroke: new ol.style.Stroke({
                        color: 'rgba(0, 100, 0, 1)',
                        width: 1
                    })
                })
            });
            break;
        case '微博签到':
            specificFolder = 'weibo';
            layerStyle = new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 5,
                    fill: new ol.style.Fill({
                        color: 'rgba(255, 99, 132, 0.7)'
                    }),
                    stroke: new ol.style.Stroke({
                        color: 'rgba(255, 0, 0, 1)',
                        width: 1
                    })
                })
            });
            break;
        case '移动轨迹':
            specificFolder = 'trajectory';
            layerStyle = new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: 'rgba(1, 43, 82, 0.93)',
                    width: 3
                }),
            });
            break;
        default:
            console.warn(`未知数据类型: ${dataType}。使用默认样式。`);
            layerStyle = new ol.style.Style({
                fill: new ol.style.Fill({
                    color: 'rgba(255, 0, 0, 0.3)'
                }),
                stroke: new ol.style.Stroke({
                    color: 'rgba(255, 0, 0, 0.8)',
                    width: 2
                })
            });
    }

    const geoJSONFileName = `${city}.geojson`;
    const geoJSONFilePath = `${geoJSONBasePath}${specificFolder}/${geoJSONFileName}`;

    console.log('尝试从以下路径加载 GeoJSON:', geoJSONFilePath);

    const newVectorSource = new ol.source.Vector({
        format: new ol.format.GeoJSON(),
        url: geoJSONFilePath
    });

    const newVectorLayer = new ol.layer.Vector({
        source: newVectorSource,
        // 样式在源加载完成后设置，因为需要所有feature的num值
        style: layerStyle
    });

    map.addLayer(newVectorLayer);
    currentGeoJSONLayer = newVectorLayer;

    // 当 GeoJSON 源数据加载完成后，如果是 OD 流，则计算 num 自然间断分级
    newVectorSource.once('change', function() {
        if (newVectorSource.getState() === 'ready') {
            const features = newVectorSource.getFeatures();
            if (features.length > 0) {
                if (dataType === 'OD流') {
                    const numValues = features.map(f => f.get('num')).filter(v => typeof v === 'number' && !isNaN(v));
                    const numBreaksCount = OD_FIVE_CLASS_COLORS.length; // 5个级别

                    // 使用自然间断分级
                    odNumBreaks = calculateNaturalBreaks(numValues, numBreaksCount);

                    console.log('OD流 num values:', numValues);
                    console.log('OD流 Natural Breaks:', odNumBreaks);
                    // 重新设置样式以应用新的分级
                    newVectorLayer.setStyle(layerStyle); // 触发图层重绘
                }

                const extent = newVectorSource.getExtent();
                map.getView().fit(extent, {
                    padding: [50, 50, 50, 50],
                    duration: 1000
                });
            } else {
                console.warn(`GeoJSON 已加载但 ${city} 不包含任何要素。`);
                dataDescriptionParagraph.textContent = `未找到 ${city} 的空间数据。`;
            }
        }
    });

    newVectorSource.on('error', function(event) {
        console.error('从以下路径加载 GeoJSON 时出错:', geoJSONFilePath, event);
        dataDescriptionParagraph.textContent = `加载 ${city} 的空间数据时出错。请确保文件存在于: ${geoJSONFilePath}`;
    });
}

// 根据当前下拉菜单选择更新地图和描述函数
function updateMapAndDescription() {
    const selectedDataType = dataTypeSelect.value;
    const selectedCity = citySelect.value;

    updateDescription();
    loadGeoJSONData(selectedDataType, selectedCity);
}

// *** 新函数：将地图重置到初始状态 ***
function resetMap() {
    // 1. 移除当前加载的任何自定义 GeoJSON 图层
    if (currentGeoJSONLayer) {
        map.removeLayer(currentGeoJSONLayer);
        currentGeoJSONLayer = null;
    }

    // 2. 将中国边界图层的样式重置为其默认样式
    chinaVectorLayer.setStyle(defaultChinaLayerStyle);

    // 3. 将地图视图调整回中国边界图层的范围
    // 这有效地将其带回到“初始状态”的缩放和中心。
    const extent = chinaVectorSource.getExtent();
    map.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 1000
    });

    // 4. 将下拉菜单重置为其默认（第一个）选项
    if (dataTypeSelect.options.length > 0) {
        dataTypeSelect.selectedIndex = 0;
        populateCityDropdown();
    }
    if (citySelect.options.length > 0) {
        citySelect.selectedIndex = 0;
    }

    // 5. 清除数据描述段落
    dataDescriptionParagraph.textContent = '';

    console.log("地图已重置到初始状态。");
}

// 事件监听器
dataTypeSelect.addEventListener('change', () => {
    populateCityDropdown();
});

refreshMapButton.addEventListener('click', updateMapAndDescription);
resetMapButton.addEventListener('click', resetMap); // 为新的重置地图按钮添加事件监听器


// 初始数据获取和设置（填充下拉菜单，但 *不* 加载地图数据）
fetchAllData();