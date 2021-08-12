import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';
// import { SceneUtils } from 'https://unpkg.com/three@0.126.1/examples/jsm/utils/SceneUtils.js';

window.territory = {};

(function(exports) {

    let spatialInterface, rendererWidth, rendererHeight;
    let camera, scene, renderer;
    let containerObj, groundPlaneContainerObj, mesh, cameraShadowGroup, defaultPin, shadowGroup, pathMesh, gridHelper;

    let raycaster = new THREE.Raycaster();
    let mouse = new THREE.Vector2();
    let isProjectionMatrixSet = false;
    let callbacks = {
        onLoaded: [],
        onContentPressed: [],
        onOccupancyChanged: []
    };

    // const radius = 1000;
    // let defaultScale = 1;
    let isRadiusOccupied = false;
    let lastComputedScale = undefined;
    let lastComputedShape = undefined;
    let lastModelMatrix = undefined;
    
    const planeSize = 5000;
    let pointsInProgress = [];

    let isEditingMode = true;
    let isDrawingPointerDown = false;

    function init(spatialInterface_, rendererWidth_, rendererHeight_, parentElement_) {
        console.log('init renderer');

        spatialInterface = spatialInterface_;
        rendererWidth = rendererWidth_;
        rendererHeight = rendererHeight_;
        
        renderer = new THREE.WebGLRenderer( { alpha: true } );
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( rendererWidth, rendererHeight );
        parentElement_.appendChild( renderer.domElement );
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.top = '0';

        camera = new THREE.PerspectiveCamera(70, rendererWidth, rendererHeight, 1, 1000);
        scene = new THREE.Scene();
        containerObj = new THREE.Object3D();
        containerObj.matrixAutoUpdate = false;
        scene.add(containerObj);

        let geometry = new THREE.BoxBufferGeometry(500, 500, 500);
        // let material = new THREE.MeshBasicMaterial({color: 0x00ffff, transparent: true, opacity: 0.7});
        // let material = new THREE.MeshPhongMaterial( { color: 0x00ffff, flatShading: true, vertexColors: THREE.VertexColors, shininess: 0 } );

        let material = new THREE.MeshStandardMaterial({color: 0x00ffff}); //, transparent: true, opacity: 1.0});

        // var materials = [
        //     new THREE.MeshPhongMaterial( { color: 0xffffff, flatShading: true, vertexColors: THREE.VertexColors, shininess: 0 } ),
        //     new THREE.MeshBasicMaterial( { color: 0x000000, flatShading: true, wireframe: true, transparent: true } )
        // ];
        // mesh = SceneUtils.createMultiMaterialObject( geometry, materials );
        //
        mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.z = Math.PI / 4;
        mesh.rotation.x = Math.PI / 4;
        mesh.name = 'handleMesh';
        containerObj.add(mesh);

        let toggleMesh = new THREE.Mesh(new THREE.BoxBufferGeometry(250, 250, 250), new THREE.MeshStandardMaterial({color: 0xffff00})); //, transparent: true, opacity: 1.0}));
        toggleMesh.rotation.z = Math.PI / 4;
        toggleMesh.rotation.x = Math.PI / 4;
        toggleMesh.position.y = 800;
        toggleMesh.name = 'toggleMesh';
        containerObj.add(toggleMesh);

        groundPlaneContainerObj = new THREE.Object3D();
        groundPlaneContainerObj.matrixAutoUpdate = false;
        scene.add(groundPlaneContainerObj);
        groundPlaneContainerObj.name = 'groundPlaneContainerObj';
        
        cameraShadowGroup = new THREE.Group();
        let cameraShadowMesh = new THREE.Mesh( new THREE.BoxGeometry( 100, 100, 100 ), new THREE.MeshBasicMaterial( {color: 0x00ffff} ) );
        cameraShadowGroup.add(cameraShadowMesh);
        groundPlaneContainerObj.add(cameraShadowGroup);

        shadowGroup = new THREE.Group();

        const gridSize = planeSize;
        const divisions = planeSize / 1000;
        const colorCenterLine = new THREE.Color(0, 1, 1);
        const colorGrid = new THREE.Color(0, 1, 1);
        gridHelper = new THREE.GridHelper( gridSize, divisions, colorCenterLine, colorGrid );
        shadowGroup.add(gridHelper);
        
        let planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
        let planeMaterial = new THREE.MeshBasicMaterial( {color: 0xff0000} ); //, transparent:true, opacity:0.5} );
        let planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
        planeMesh.rotation.x = -Math.PI / 2;
        planeMesh.visible = false;
        planeMesh.name = 'planeMesh';
        shadowGroup.add( planeMesh );

        let geometrycube = new THREE.BoxGeometry( 10, 10, 10 );
        let materialcube = new THREE.MeshBasicMaterial( {color: 0xffffff} );
        defaultPin = new THREE.Mesh( geometrycube, materialcube );  // white
        shadowGroup.add( defaultPin );
        defaultPin.position.set(0, 0, 0);
        let material1 = new THREE.MeshBasicMaterial( {color: 0xff0000} );
        let material2 = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
        let material3 = new THREE.MeshBasicMaterial( {color: 0x0000ff} );
        let cube_z = new THREE.Mesh( geometrycube, material2 ); // green
        let cube_y = new THREE.Mesh( geometrycube, material3 ); // blue
        let cube_x = new THREE.Mesh( geometrycube, material1 );  // red
        shadowGroup.add( cube_x );
        shadowGroup.add( cube_z );
        shadowGroup.add( cube_y );
        cube_x.position.set(50, 0, 0);
        cube_y.position.set(0, 50, 0);
        cube_z.position.set(0, 0, 50);
        cube_y.name = 'cube_y';
        cube_z.name = 'cube_z';
        cube_x.name = 'cube_x';
        groundPlaneContainerObj.add(shadowGroup);

        // let path = [];
        // let numPoints = 10;
        // for (let theta = 0; theta < 2 * Math.PI; theta += (2*Math.PI) / numPoints) {
        //     path.push( {x: radius * Math.cos(theta), y: 0, z: radius * Math.sin(theta)} );
        // }
        // path.push({x: radius * Math.cos(0), y: 0, z: radius * Math.sin(0)}); // end where you started
        // pathMesh = window.pathToMesh(path);
        // shadowGroup.add(pathMesh);
        
        // updatePathMesh(1);

        // light the scene with a combination of ambient and directional white light
        var ambLight = new THREE.AmbientLight(0xffffff);
        groundPlaneContainerObj.add(ambLight);
        var dirLight1 = new THREE.DirectionalLight(0xffffff, 1);
        dirLight1.position.set(0, 5000, 0);
        groundPlaneContainerObj.add(dirLight1);
        var dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
        dirLight2.position.set(-100, -100, -100);
        groundPlaneContainerObj.add(dirLight2);

        // spatialInterface.addMatrixListener(renderScene);
        spatialInterface.addGroundPlaneMatrixListener(updateGroundplane);
        spatialInterface.addModelAndViewListener(updateWithModelAndView);
        spatialInterface.registerTouchDecider(touchDecider);
        spatialInterface.setFullScreenOn();
    }
    
    function updateGroundplane(modelView, projection) {
        if (isProjectionMatrixSet && modelView && modelView.length === 16) {
            setMatrixFromArray(groundPlaneContainerObj.matrix, modelView);

            // let groundPlaneCoordinates = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);    // world coordinates
            // groundPlaneContainerObj.worldToLocal(groundPlaneCoordinates);   // convert to ground plane coordinates

            let meshCoordinates = new THREE.Vector3(mesh.position.x, mesh.position.y, mesh.position.z);    // world coordinates
            mesh.localToWorld(meshCoordinates);
            groundPlaneContainerObj.worldToLocal(meshCoordinates);   // convert to ground plane coordinates

            shadowGroup.position.set(meshCoordinates.x, 0, meshCoordinates.z);
            
            let cameraCoordinates = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);
            cameraShadowGroup.parent.worldToLocal(cameraCoordinates);

            cameraShadowGroup.position.set(cameraCoordinates.x, 0, cameraCoordinates.z);
        }
    }
    
    function updateWithModelAndView(model, view, projection) {
        lastModelMatrix = model;
        let modelView = [];
        multiplyMatrix(model, view, modelView);
        renderScene(modelView, projection);
    }
    
    function renderScene(modelView, projection) {
        if (!isProjectionMatrixSet && projection && projection.length === 16) {
            setMatrixFromArray(camera.projectionMatrix, projection);
            camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
            isProjectionMatrixSet = true;
        }

        // 10. Every frame, set the position of the containerObj to the modelViewMatrix
        if (isProjectionMatrixSet && modelView && modelView.length === 16) {
            setMatrixFromArray(containerObj.matrix, modelView);
            // if (lastModelMatrix) {
            //     updatePathMesh(lastModelMatrix[0]);
            // }
            renderer.render(scene, camera);
            onSceneRendered();
        }
    }
    
    function isShapeDefined() {
        return lastComputedShape && JSON.parse(lastComputedShape).length > 2 && pointsInProgress.length === 0;
    }
    
    function onSceneRendered() {
        if (!isShapeDefined()) { return; }
        
        let cameraCoordinates = new THREE.Vector3(cameraShadowGroup.position.x, cameraShadowGroup.position.y, cameraShadowGroup.position.z);    // world coordinates
        cameraShadowGroup.parent.localToWorld(cameraCoordinates);

        // calculate using even-odd rule
        let hullPoints = JSON.parse(lastComputedShape).map(function(point) {
            let worldCoords = new THREE.Vector3(point.x, point.y, point.z);    // world coordinates
            shadowGroup.localToWorld(worldCoords);
            return [worldCoords.x, worldCoords.z];
        });
        let isInside = checkPointConcave(cameraCoordinates.x, cameraCoordinates.z, hullPoints);

        // if (isInside) {
        //     mesh.rotation.z += 0.03; // make it spin
        // }

        if (isRadiusOccupied && !isInside) {
            isRadiusOccupied = false;
            callbacks.onOccupancyChanged.forEach(function(callback) {
                callback(false);
            });
        } else if (!isRadiusOccupied && isInside) {
            isRadiusOccupied = true;
            callbacks.onOccupancyChanged.forEach(function(callback) {
                callback(true);
            });
        }
    }

    function touchDecider(eventData) {
        // 1. sets the mouse position with a coordinate system where the center
        //    of the screen is the origin
        mouse.x = ( eventData.x / window.innerWidth ) * 2 - 1;
        mouse.y = - ( eventData.y / window.innerHeight ) * 2 + 1;

        // 2. set the picking ray from the camera position and mouse coordinates
        raycaster.setFromCamera( mouse, camera );

        // 3. compute intersections
        var intersects = raycaster.intersectObjects( scene.children, true );
        
        if (intersects.length > 0) {
            callbacks.onContentPressed.forEach(function(callback) {
                callback(intersects);
            });
        }

        return intersects.length > 0;
    }

    // 11. This is just a helper function to set a three.js matrix using an array
    function setMatrixFromArray(matrix, array) {
        matrix.set( array[0], array[4], array[8], array[12],
            array[1], array[5], array[9], array[13],
            array[2], array[6], array[10], array[14],
            array[3], array[7], array[11], array[15]);
    }

    function onLoaded(callback) {
        callbacks.onLoaded.push(callback);
    }

    function onContentPressed(callback) {
        callbacks.onContentPressed.push(callback);
    }
    
    function onOccupancyChanged(callback) {
        callbacks.onOccupancyChanged.push(callback);
    }
    
    function loadShapeData(points) {
        console.log('load shape data', points);
        updatePathMesh(JSON.parse(JSON.stringify(points)), 1.0);
    }

    function updatePathMesh(shape, scale) {
        if (typeof lastComputedShape !== 'undefined' && JSON.stringify(shape) === lastComputedShape) {
            if (typeof lastComputedScale !== 'undefined' && scale.toFixed(3) === lastComputedScale.toFixed(3)) {
                return; // if neither shape or scale has changed, don't recompute the scaled shape path
            }
        }
        if (pathMesh) { 
            shadowGroup.remove(pathMesh);
        }
        let scaledShapePath = shape; // TODO: scale everything up relative to the origin

        pathMesh = window.pathToMesh(scaledShapePath);
        shadowGroup.add(pathMesh);

        lastComputedScale = scale;
        lastComputedShape = JSON.stringify(shape);
    }
    
    function getRaycastIntersects(clientX, clientY) {
        mouse.x = ( clientX / window.innerWidth ) * 2 - 1;
        mouse.y = - ( clientY / window.innerHeight ) * 2 + 1;

        //2. set the picking ray from the camera position and mouse coordinates
        raycaster.setFromCamera( mouse, camera );

        //3. compute intersections
        return raycaster.intersectObjects( scene.children, true );
    }

    function pointerDown(screenX, screenY) {
        if (!isEditingMode) { return; }

        const intersects = getRaycastIntersects(screenX, screenY);
        if (intersects.length > 0) {
            if (intersects[0].object.name === 'planeMesh') {
                console.log('pointerDown in territory')
                pointsInProgress = [];
                isDrawingPointerDown = true;
            }
        }
    }

    function pointerMove(screenX, screenY) {
        if (!isEditingMode) { return; }
        if (!isDrawingPointerDown) { return; }

        console.log('pointerMove in territory')

        // calculate objects intersecting the picking ray
        const intersects = getRaycastIntersects(screenX, screenY);

        let planeIntersect = null;
        intersects.forEach(function(intersect) {
            if (planeIntersect) { return; }
            // if (intersect.object.geometry.type === 'PlaneGeometry') {
            if (intersect.object.name === 'planeMesh') {
                planeIntersect = intersect;
            }
        });

        if (planeIntersect) {
            pointsInProgress.push({
                x: (planeIntersect.uv.x - 0.5) * planeSize, // times (dScale between draw time and now)
                y: 0,
                z: -1 * (planeIntersect.uv.y - 0.5) * planeSize
            });
            
            updatePathMesh(pointsInProgress, 1);
        }
    }

    function pointerUp(_screenX, _screenY) {
        if (!isEditingMode) { return; }
        if (!isDrawingPointerDown) { return; }

        console.log('pointerUp in territory')
        
        let hullPoints = [];
        pointsInProgress.forEach(function(point) {
            hullPoints.push([point.x, point.z]);
        });

        const concavity = Infinity; // Infinite concavity = convex hull (what we want!)
        let rawHullPath = hull(hullPoints, concavity);
        
        let validHullPath = rawHullPath.map(function(hullPoint) {
            return {
                x: hullPoint[0],
                y: 0,
                z: hullPoint[1]
            };
        });

        updatePathMesh(validHullPath, 1);

        window.storage.write('shape', validHullPath);
        pointsInProgress = [];
        isDrawingPointerDown = false;
    }

    /**
     * Uses the even-odd rule (https://en.wikipedia.org/wiki/Even–odd_rule) to check if a point is inside the shape.
     * Casts a ray horizontally to the right from this point and counts the number of segment intersections
     * @param {number} x
     * @param {number} y
     * @param {Array.<Array.<number>>} hull - list of points that form the hull [[x1, y1], [x2, y2], ...]
     * @returns {boolean}
     */
    function checkPointConcave(x, y, hull) {
        let evenOddCounter = 0;
        for (let i = 0; i < hull.length; i++) {
            let x1 = hull[i][0];
            let y1 = hull[i][1];
            let x2, y2;
            if (i+1 < hull.length) {
                x2 = hull[i+1][0];
                y2 = hull[i+1][1];
            } else {
                x2 = hull[0][0]; // edge case for last segment
                y2 = hull[0][1];
            }

            if (x1 < x && x2 < x) {
                continue;
            }

            if (y1 < y && y2 > y || y1 > y && y2 < y) {
                evenOddCounter += 1; // intersection between horizontal ray and segment
            }
        }

        return evenOddCounter % 2 === 1;
    }
    
    function toggleEditingMode() {
        isEditingMode = !isEditingMode;
        if (isEditingMode) {
            // show gridHelper
            gridHelper.visible = true;
        } else {
            // hide gridHelper
            gridHelper.visible = false;
        }
    }

    exports.init = init;
    exports.onLoaded = onLoaded;
    exports.onContentPressed = onContentPressed;
    exports.onOccupancyChanged = onOccupancyChanged;
    exports.loadShapeData = loadShapeData;

    exports.pointerDown = pointerDown;
    exports.pointerMove = pointerMove;
    exports.pointerUp = pointerUp;

    exports.toggleEditingMode = toggleEditingMode;

})(window.territory);
