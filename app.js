require([
    "esri/Map",
    "esri/views/SceneView",
    "esri/layers/GeoJSONLayer",
    "esri/Graphic",
    "esri/symbols/SimpleLineSymbol",
    "esri/symbols/PictureMarkerSymbol",
    "esri/renderers/SimpleRenderer",
    "esri/widgets/Legend"
], function (Map, SceneView, GeoJSONLayer, Graphic, SimpleLineSymbol, PictureMarkerSymbol, SimpleRenderer, Legend) {
    // 初始化 Web 场景地图
    const map = new Map({
        basemap: "topo-vector",
        ground: "world-elevation"
    });

    // 初始化 3D 场景视图
    const view = new SceneView({
        container: "viewDiv",
        map: map,
        camera: {
            position: [8.57, 50.03, 10000], // 初始高度
            tilt: 80
        }
    });

    // GeoJSON 数据链接
    const geojsonUrl = "https://www.arcgis.com/sharing/rest/content/items/082ebada8c124f21b4b6f099e2c06126/data";  // 实际链接

    // 创建 GeoJSONLayer 实例
    const geojsonLayer = new GeoJSONLayer({
        url: geojsonUrl,
        elevationInfo: {
            mode: "relative-to-ground"
        }
    });

    // 设置航迹线条的符号
    const lineSymbol = new SimpleLineSymbol({
        color: [0, 0, 255],
        width: 2
    });

    // 设置 GeoJSONLayer 渲染器
    geojsonLayer.renderer = new SimpleRenderer({
        symbol: lineSymbol
    });

    map.add(geojsonLayer);

    // 自定义飞机图标
    const pointSymbol = new PictureMarkerSymbol({
        url: "https://raw.githubusercontent.com/WHxxxxWH/plane/refs/heads/main/飞机.svg", 
        width: "20px",
        height: "20px"
    });

    // 飞机图标的Graphic
    let planeGraphic = null;

    // 加载航迹数据并添加点
    geojsonLayer.when(() => {
        geojsonLayer.queryFeatures().then(response => {
            const coords = response.features[0].geometry.paths[0]; // 假设只有一个轨迹

            // 创建飞机图标
            planeGraphic = new Graphic({
                geometry: {
                    type: "point",
                    longitude: coords[0][0],
                    latitude: coords[0][1],
                    z: coords[0][2]
                },
                symbol: pointSymbol
            });

            // 添加飞机图标到视图
            view.graphics.add(planeGraphic);
        });
    });

    // 动画函数，让图标沿着线轨迹移动
    function animatePlane() {
        geojsonLayer.when(() => {
            geojsonLayer.queryFeatures().then(response => {
                const coords = response.features[0].geometry.paths[0]; // 假设只有一个轨迹
                let pathIndex = 0;
    
                // 移动图标到下一个点
                function movePlane() {
                    if (pathIndex >= coords.length) {
                        console.log('Reached the end of the path.');
                        pathIndex = 0; // 重新开始
                    }
    
                    const currentCoord = coords[pathIndex];
                    planeGraphic.set('geometry', {
                        type: 'point',
                        longitude: currentCoord[0],
                        latitude: currentCoord[1],
                        z: currentCoord[2] || 0 // 确保z值存在
                    });
    
                    pathIndex++;
                    console.log(`Moving to point ${pathIndex} of ${coords.length}`);
    
                    // 1秒移动到下一个点
                    setTimeout(movePlane, 1000);
                }
    
                movePlane(); // 开始动画
            }).catch(error => {
                console.error('Error loading or processing the GeoJSON data:', error);
            });
        });
    }

    // 启动动画
    animatePlane();

    // 添加图例
    const legend = new Legend({
        view: view,
        layerInfos: [{
            layer: geojsonLayer,
            title: "航班轨迹"
        }]
    });
    view.ui.add(legend, "bottom-right");

    // 查询航班功能
    document.getElementById("searchButton").addEventListener("click", function () {
        const flightId = document.getElementById("flightInput").value.trim();
        if (!flightId) {
            alert("请输入航班号！");
            return;
        }

        // 设置过滤器显示指定航班
        geojsonLayer.definitionExpression = `FlightID = '${flightId}'`;

        // 获取航班的边界框
        geojsonLayer.queryExtent().then(function (response) {
            // 调整视角，定位到包含航迹的区域
            view.goTo({
                target: planeGraphic.geometry,
                tilt: 60, // 设定倾斜角度
                zoom: 10  // 增加缩放比例来精确显示航迹
            }).catch(err => console.error("视角定位失败：", err));
        });
    });

    


     // === 新增部分: 流量预测图表 ===

     // CSV 文件 URL
    const csvUrl = "https://raw.githubusercontent.com/WHxxxxWH/plane/refs/heads/main/result.csv"; // 替换为你的CSV文件链接

    let flowData = [];

    
    // 加载CSV数据并解析
    fetch(csvUrl)
        .then(response => response.text())
        .then(text => {
            const lines = text.split("\n");
            // 跳过第一行（标题），然后解析每一行
            for (let i = 1; i < lines.length; i++) {
                const [time, flow] = lines[i].split(",");
                if (time && flow) {
                    flowData.push({ time: time.trim(), flow: flow.trim() });
                }
            }

        })
        .catch(err => console.error("加载CSV失败", err));

    // 格式化输入的时间，去除分钟部分的前导零
    function formatDateToCSVFormat(inputDate) {
        const date = new Date(inputDate);
        
        // 如果日期格式错误，返回null
        if (isNaN(date)) {
            return null;
        }

        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 月份从0开始，所以需要加1
        const day = date.getDate();
        const hours = date.getHours();
        let minutes = date.getMinutes();
        
        // 返回格式为 "YYYY/MM/DD HH:MM"
        return `${year}/${month}/${day} ${hours}:${minutes}`;
    }

    // 格式化并去除用户输入时间中的空格
    function normalizeTimeInput(inputTime) {
        return inputTime.replace(/\s+/g, '').toLowerCase();
    }

    // 查询流量的功能
    document.getElementById("predictButton").addEventListener("click", function () {
        const dateInput = document.getElementById("dateInput").value.trim();
        if (!dateInput) {
            alert("请输入日期和时间！");
            return;
        }

        // 格式化输入时间为 CSV 时间格式
        const formattedDate = formatDateToCSVFormat(dateInput);
        
        if (!formattedDate) {
            alert("无效的时间格式，请使用正确的时间格式！");
            return;
        }

        const normalizedDate = normalizeTimeInput(formattedDate); // 去除空格并标准化格式
        console.log("查询时间:", normalizedDate); // 输出调试信息，检查是否正确格式化时间

        // 查找该时间点的流量数据
        const flowResult = flowData.find(item => normalizeTimeInput(item.time) === normalizedDate);

        if (flowResult) {
            document.querySelector("[flow='flowResult']").innerText = `该时间点的流量为: ${flowResult.flow}`;

            // 根据日期选择HTML文件路径
            let htmlFilePath = "";
            if (normalizedDate.startsWith("2018/7/7")) {
                htmlFilePath = "D:/ACode/CodeVs/jiruandazuoye/12_24_2/data7_7.html"; // HTML文件路径
            } else if (normalizedDate.startsWith("2018/7/8")) {
                htmlFilePath = "D:/ACode/CodeVs/jiruandazuoye/12_24_2/data7_8.html" ; // HTML文件路径
            } else if (normalizedDate.startsWith("2018/7/9")) {
                htmlFilePath = "D:/ACode/CodeVs/jiruandazuoye/12_24_2/data7_9.html"; // HTML文件路径
            } else {
                document.getElementById("htmlContentDiv").style.display = "none"; // 如果没有找到匹配日期，隐藏HTML内容
                return;
            }

            // 显示HTML文件
            document.getElementById("htmlContentIframe").src = htmlFilePath;
            document.getElementById("htmlContentDiv").classList.add("centered-container"); // 添加类以居中显示
            document.getElementById("htmlContentDiv").style.display = "block"; // 显示HTML内容

        } else {
            document.querySelector("[flow='flowResult']").innerText = `未找到该时间点的流量数据。`;

            // 如果没有找到对应的流量数据，隐藏HTML内容
            document.getElementById("htmlContentDiv").style.display = "none";
        }
    });

  // === 额外改进 ===

    // 为了确保时间选择器的时间从 2018/7/7 0:20 开始，我们可以在 HTML 中进行如下调整：
    const dateInput = document.getElementById("dateInput");
    const initialDate = new Date('2018-07-07T00:20:00'); // 设置初始日期为 2018/7/7 0:20
    dateInput.value = initialDate.toISOString().slice(0, 16); // 格式化并设置为输入框的默认值

    // 设置分钟间隔为 15 分钟
    dateInput.setAttribute('step', '900'); // 15 分钟 = 900 秒
});
