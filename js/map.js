// OpenLayers Map Initialization with ArcGIS Basemap
const map = new ol.Map({
    target: 'map', // The ID of the div element for the map
    layers: [
        new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
                attributions: 'Tiles &copy; Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN'
            })
        })
    ],
    view: new ol.View({
        center: ol.proj.fromLonLat([104.07, 30.67]), // Center map to Chengdu, China (longitude, latitude)
        zoom: 3,
        projection: 'EPSG:3857' // Unified projection: Web Mercator
    })
});

// Default style for China boundaries (transparent fill, blue border)
const defaultChinaLayerStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: 'rgba(123, 123, 201, 0.8)', // Blue border with some transparency
        width: 1
    }),
    fill: new ol.style.Fill({
        color: 'rgba(255, 255, 255, 0)' // Completely transparent fill
    })
});

// Create a vector source for the GeoJSON data (initially for China boundaries)
const chinaVectorSource = new ol.source.Vector({
    format: new ol.format.GeoJSON(),
    url: 'data/geodata/china.geojson' // Path to your china.geojson file
});

// Create a vector layer for the GeoJSON data (initially for China boundaries)
const chinaVectorLayer = new ol.layer.Vector({
    source: chinaVectorSource,
    style: defaultChinaLayerStyle // Apply default style
});

// Add the vector layer to the map
map.addLayer(chinaVectorLayer);

// When the GeoJSON features are loaded, fit the map view to their extent
chinaVectorSource.on('addfeature', function() {
    const extent = chinaVectorSource.getExtent();
    map.getView().fit(extent, {
        padding: [50, 50, 50, 50], // Add some padding around the extent
        duration: 1000 // Smooth animation for fitting
    });
});

// --- Dynamic Data Loading and Dropdown Population ---

const dataTypeSelect = document.getElementById('dataType');
const citySelect = document.getElementById('citySelect');
const refreshMapButton = document.getElementById('refreshMap');
const dataDescriptionParagraph = document.getElementById('dataDescription');
const resetMapButton = document.getElementById('resetMap'); // Reference to the new Reset Map button


let allData = []; // To store the fetched data from all.json
let poiProvinceCounts = {}; // To store POI counts by province for choropleth
let currentGeoJSONLayer = null; // To keep track of the currently displayed GeoJSON layer

// --- POI Choropleth Styling Configuration ---
// 5-class sequential green-blue color scheme for choropleth
const POI_CHOROPLETH_COLORS = ['#edf8e9', '#bae4b3', '#7bccc4', '#43a2ca', '#0868ac'];
const POI_CHOROPLETH_BREAKS = []; // To be calculated dynamically based on data

// --- OD流 5级分级颜色和宽度配置 ---
// 红色的5级渐变，用于OD流的num值分级
const OD_FIVE_CLASS_COLORS = ['#fee0d2', '#fc9272', '#fb6a4a', '#de2d26', '#a50f15'];
// 对应的宽度， num值越大线越粗
const OD_FIVE_CLASS_WIDTHS = [1, 2, 3, 4, 5];

let odNumBreaks = []; // 用于存储OD流的num值分级点 (Jenks Natural Breaks)

// Function to calculate quantile breaks for choropleth styling (Fallback)
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

// Function to calculate natural breaks for choropleth styling (using simple-statistics)
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


// Function to get color based on value and breaks
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

// Function to fetch data from all.json
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
        dataDescriptionParagraph.textContent = 'Error loading data. Please try again later.';
    }
}

// Function to fetch POI province counts for a specific year
async function fetchPoiProvinceCounts(year) {
    const statsFilePath = `data/geodata/poi/全国(${year}).json`;
    try {
        const response = await fetch(statsFilePath);
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`POI provincial stats file not found: ${statsFilePath}. Initializing counts to 0.`);
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
        // POI Choropleth 默认使用分位数分级
        POI_CHOROPLETH_BREAKS.push(...calculateQuantileBreaks(counts, numBreaks));

        if (POI_CHOROPLETH_BREAKS.length === 0 && counts.length > 0) {
            POI_CHOROPLETH_BREAKS.push(Math.max(...counts));
        }

        console.log(`POI Province Counts for ${year} fetched/processed:`, poiProvinceCounts);
        console.log('POI Choropleth Breaks:', POI_CHOROPLETH_BREAKS);

    } catch (error) {
        console.error(`Error fetching or processing ${statsFilePath}:`, error);
        dataDescriptionParagraph.textContent = `Error loading POI provincial statistics for ${year}.`;
        poiProvinceCounts = {};
        POI_CHOROPLETH_BREAKS.length = 0;
    }
}

// Function to populate the Data Type dropdown
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

// Function to populate the City dropdown based on selected Data Type
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

// Function to update the description paragraph
function updateDescription() {
    const selectedDataType = dataTypeSelect.value;
    const selectedDataItem = allData.find(item => item.type === selectedDataType);
    if (selectedDataItem && selectedDataItem.description) {
        dataDescriptionParagraph.textContent = selectedDataItem.description;
    } else {
        dataDescriptionParagraph.textContent = 'No description available for this data type.';
    }
}


// Function to load and display GeoJSON data on the map
async function loadGeoJSONData(dataType, city) {
    // Always reset chinaVectorLayer style first
    chinaVectorLayer.setStyle(defaultChinaLayerStyle);
    // Remove existing specific GeoJSON layer if any (points, lines, polygons)
    if (currentGeoJSONLayer) {
        map.removeLayer(currentGeoJSONLayer);
        currentGeoJSONLayer = null;
    }

    if (!dataType || !city) {
        console.warn("Data type or city not selected. Cannot load GeoJSON.");
        return;
    }

    // --- Special handling for POI provincial choropleth ---
    if (dataType === 'POI' && city.startsWith('全国(')) {
        const yearMatch = city.match(/\((\d{4})\)/);
        const year = yearMatch ? yearMatch[1] : null;

        if (!year) {
            dataDescriptionParagraph.textContent = "Error: Could not extract year from POI data selection.";
            return;
        }

        await fetchPoiProvinceCounts(year);

        if (Object.keys(poiProvinceCounts).length === 0 && POI_CHOROPLETH_BREAKS.length === 0) {
            dataDescriptionParagraph.textContent = `POI provincial data for ${year} not available or loaded incorrectly.`;
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

        console.log(`Displayed POI choropleth for ${city}`);
        return;
    }

    // --- General handling for other GeoJSON types (points, lines, custom polygons) ---
    let geoJSONBasePath = 'data/geodata/';
    let specificFolder = '';
    let customStyle = null;


    switch (dataType) {
        case 'AOI':
            specificFolder = 'aoi';
            customStyle = new ol.style.Style({
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
            customStyle = (feature) => {
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
            customStyle = new ol.style.Style({
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
            customStyle = new ol.style.Style({
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
            customStyle = new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: 'rgba(1, 43, 82, 0.93)',
                    width: 3
                }),
            });
            break;
        default:
            console.warn(`Unknown data type: ${dataType}. Using default style.`);
            customStyle = new ol.style.Style({
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

    console.log('Attempting to load GeoJSON from:', geoJSONFilePath);

    const newVectorSource = new ol.source.Vector({
        format: new ol.format.GeoJSON(),
        url: geoJSONFilePath
    });

    const newVectorLayer = new ol.layer.Vector({
        source: newVectorSource,
        // 样式在源加载完成后设置，因为需要所有feature的num值
        style: customStyle
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
                    newVectorLayer.setStyle(customStyle); // 触发图层重绘
                }

                const extent = newVectorSource.getExtent();
                map.getView().fit(extent, {
                    padding: [50, 50, 50, 50],
                    duration: 1000
                });
            } else {
                console.warn(`GeoJSON loaded but contains no features for ${city}.`);
                dataDescriptionParagraph.textContent = `No spatial data found for ${city}.`;
            }
        }
    });

    newVectorSource.on('error', function(event) {
        console.error('Error loading GeoJSON from:', geoJSONFilePath, event);
        dataDescriptionParagraph.textContent = `Error loading spatial data for ${city}. Make sure the file exists at: ${geoJSONFilePath}`;
    });
}

// Function to update map and description based on current dropdown selections
function updateMapAndDescription() {
    const selectedDataType = dataTypeSelect.value;
    const selectedCity = citySelect.value;

    updateDescription();
    loadGeoJSONData(selectedDataType, selectedCity);
}

// *** NEW FUNCTION: Reset Map to Initial State ***
function resetMap() {
    // 1. Remove any currently loaded custom GeoJSON layer
    if (currentGeoJSONLayer) {
        map.removeLayer(currentGeoJSONLayer);
        currentGeoJSONLayer = null;
    }

    // 2. Reset the style of the China boundary layer to its default
    chinaVectorLayer.setStyle(defaultChinaLayerStyle);

    // 3. Fit the map view back to the extent of the China boundary layer
    // This effectively brings it back to the "initial state" zoom and center.
    const extent = chinaVectorSource.getExtent();
    map.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 1000
    });

    // 4. Reset dropdowns to their default (first) options
    if (dataTypeSelect.options.length > 0) {
        dataTypeSelect.selectedIndex = 0;
        populateCityDropdown();
    }
    if (citySelect.options.length > 0) {
        citySelect.selectedIndex = 0;
    }

    // 5. Clear the data description paragraph
    dataDescriptionParagraph.textContent = '';

    console.log("Map reset to initial state.");
}

// Event Listeners
dataTypeSelect.addEventListener('change', () => {
    populateCityDropdown();
});

refreshMapButton.addEventListener('click', updateMapAndDescription);
resetMapButton.addEventListener('click', resetMap); // Add event listener for the new Reset Map button


// Initial data fetch and setup (Populates dropdowns, but *does not* load map data)
fetchAllData();