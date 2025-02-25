(function () {
    var app = angular.module('BuildergameExperimentApp', ["Lingoturk"]);

    app.controller('RenderController', [
        '$http', '$timeout', '$scope', function ($http, $timeout, $scope) {
        var self = this;
        self.state = "";
        self.allStates = [];
        self.questions = [];
        self.part = null;
        self.slideIndex = 0;
        self.questionIndex = 0;
        self.expId = null;
        self.questionId = null;
        self.partId = null;
        self.origin = null;
        self.hitId = "";
        self.assignmentId = "";
        self.workerId = "";
        self.subListMap = {};
        self.subListsIds = [];
        self.showMessage = "none";
        self.redirectUrl = null;

        self.shuffleQuestions = true;
        self.shuffleSublists = true;
        self.useGoodByeMessage = true;
        self.useStatistics = false;

        self.isDisabledBuilding = false;



        self.statistics = [
            {name : "Age", type: "number", answer : undefined},
            {name : "Gender", type: "text", answer : ""},
            {name : "Nationality", type: "text", answer : ""},
            {name : "Mother's first language", type: "text", answer : ""},
            {name : "Father's first language", type: "text", answer : ""},
            {name : "Are you bilingual (grown up with more than one language)?", type: "boolean", answer : undefined},
            {name : "Please list the languages you speak at at the advance level.", type: "text", answer : "", optional : true}
        ];

        self.Colors = {
            White: 0xffffff,
            Blue1: 0xBCCCDC,
            Blue2: 0x486581,
            Gray: 0x808080,
        };

        self.LegoColors = {
            Green: 0x1e8449,
            Red: 0xC91A09,
            Blue: 0x3374ff,
            Yellow: 0xf4d03f,
            Purple: 0x7d3c98
        };

        self.LegoDimensions = {
            Width: 99,
            Height: 99,
            Depth: 99,
        };

        self.objects = []; // Objects that raycaster should consider when performing intersection checks
        self.blocks = [];
        self.isShiftKeyDown = false;

         self.params = {
            color: self.LegoColors.Green, // Default color
            colors: Object.keys(self.LegoColors), // Available colors
            selectedColor: 'Green'
         };


        this.resultsSubmitted = function(){
            self.subListsIds.splice(0,1);
            if(self.subListsIds.length > 0 ){
                self.showMessage = "nextSubList";
            }else{
                self.processFinish();
            }
        };

        this.processFinish = function(){
            if(!self.useGoodByeMessage){
                self.finished();
            }else{
                self.showMessage = "goodBye";
            }
        };

        this.finished = function(){
            if(self.origin == null || self.origin == "NOT AVAILABLE"){
                bootbox.alert("Results successfully submitted. You might consider redirecting your participants now.");
            }else if(self.origin == "MTURK"){
                $("#form").submit();
            }else if(self.origin == "PROLIFIC"){
				if(inIframe()){
                    window.top.location.href = self.redirectUrl;
                }else{
                    window.location = self.redirectUrl;
                }
            }
        };

        this.nextSublist = function(){
            self.questionIndex = 0;
            self.questions = self.subListMap[self.subListsIds[0]];
            self.showMessage = "none";
        };

        this.resultSubmissionError = function(){
            self.failedTries = 0;
            bootbox.alert("An error occurred while submitting your results. Please try again in a few seconds.");
        };

        this.handleError = function(){
            if(self.failedTries < 100){
                ++self.failedTries;
                setTimeout(function() { self.submitResults(self.resultsSubmitted, self.handleError) }, 1000);
            }else{
                self.resultSubmissionError();
            }
        };

        self.failedTries = 0;
        this.submitResults = function (successCallback, errorCallback) {
            var results = {
                experimentType : "BuildergameExperiment",
                results : self.questions,
                expId : self.expId,
                origin : self.origin,
                statistics : self.statistics,
                assignmentId : self.assignmentId,
                hitId : self.hitId,
                workerId : self.workerId,
                partId : (self.partId == null ? -1 : self.partId)
            };


            $http.post("/submitResults", results)
                .success(successCallback)
                .error(errorCallback);
        };

        this.next = function(){
            if(self.state == "workerIdSlide"){
                if(self.questionId == null && self.partId == null){
                    self.load(function(){
                        self.state = self.allStates[++self.slideIndex];
                    });
                    return;
                }
            }

            if(self.slideIndex + 1 < self.allStates.length){
                self.state = self.allStates[++self.slideIndex];
            }else{
                self.submitResults(self.resultsSubmitted, self.handleError);
            }
        };

        this.parseBlocks = function(){

        /**
         * Extracts and returns all objects with BoxGeometry from the objects array
         * @returns {Array} An array of objects containing position and color information
         */
          const results = [];

              for (let i = 0; i < self.objects.length; i++) {
                const object = self.objects[i];

                // Check if the object has geometry and if it's a BoxGeometry
                if (object.geometry && object.geometry.type === 'BoxGeometry') {
                  // Get the color as a string from LegoColors
                  let colorName = "Unknown";
                  if (object.material && object.material.color) {
                    const hexValue = object.material.color.getHex();

                    // Find the corresponding color name in LegoColors
                    for (const [name, value] of Object.entries(self.LegoColors)) {
                      if (value === hexValue) {
                        colorName = name;
                        break;
                      }
                    }
                  }

                  // Create an entry with position array and color name
                  const entry = {
                    position: object.position.toArray(),
                    color: colorName
                  };

                  results.push(entry);
                }
              }

            return results;
          }

        this.nextQuestion = function(){
            // find what blocks are on grid

            // this should go into answer, but I am not sure  how to do that
            self.questions[self.questionIndex].built_blocks = self.parseBlocks()


            if(self.questionIndex + 1 < self.questions.length){
                ++self.questionIndex;
            }else{
                self.next();
            }
        };

        this.onKeyDown = function(event) {
            if (event.keyCode === 16) {
                self.isShiftKeyDown = true;
                self.hoverLegoMesh.visible = false;
            }
         };

        this.onKeyUp = function(event) {
            if (event.keyCode === 16) {
                self.isShiftKeyDown = false;
                self.hoverLegoMesh.visible = true;
            }
        };

        this.onWindowResize = function() {


            container = document.getElementById('canvas-container');
            const rect = container.getBoundingClientRect();
            self.camera.aspect = rect.width / rect.height;
            self.camera.updateProjectionMatrix();
            self.renderer.setSize(rect.width, rect.height);
            self.render();
        };


        this.loadA = function () {

         self.init()
         // This is just for development, ultiately this should be in the csv where
         // the experiment material is stored
         self.questions[0].instruction = "Build a tower of five purple blocks in the middle of the grid. Now build a green one directly on the left of it."
         self.questions[0].starting_blocks = [
             {color: "Green", position: [100, 50, 0]}
         ]

         self.questions[1].instruction = "Put a red block in each corner, then stack two blocks on top of each red block."
         self.questions[1].starting_blocks = []

         self.questions[2].instruction = "Stack six green blocks in the middle of the map. Now build a stack of four immediately to the right of it."
         self.questions[2].starting_blocks = []

         // if the question refers to already built structure, now load it
         self.load_existing_structure(self.questions[self.questionIndex].starting_blocks)

         self.gui = new dat.GUI({ autoPlace: false });
         self.gui.domElement.id = 'gui';
         self.gui.add(self.params, 'selectedColor', self.params.colors)
                   .onChange(function(value) {
                       // Update hover guide color
                       self.hoverLegoMaterial.color.setHex(self.LegoColors[value]);
                       self.params.color = self.LegoColors[value];
                       self.render();
                   });
         document.getElementById('canvas-container').appendChild(self.gui.domElement);

            // Event listeners
         document.addEventListener('pointermove', this.onPointerMove); // user moves the mouse pointer
         document.addEventListener('pointerdown', this.onPointerDown); // user presses a mouse button
         document.addEventListener('keydown', this.onKeyDown); // user presses a key
         document.addEventListener('keyup', this.onKeyUp); // user releases a key
         window.addEventListener('resize', this.onWindowResize);
         this.animate();

        };


        // Render loop
      this.animate = function () {
        requestAnimationFrame(this.animate.bind(this));
        this.render();
      };


      this.init = function () {


            // Camera
            self.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
            self.camera.position.set(400, 800, 1200); // x, y, z
            self.camera.lookAt(0, 0, 0);

            // Scene
            self.scene = new THREE.Scene();
            self.scene.background = new THREE.Color(self.Colors.Blue2);

            // Add center cell marker
            const centerCellGeometry = new THREE.PlaneGeometry(100, 100); // Size of one grid cell
            centerCellGeometry.rotateX(-Math.PI / 2); // Rotate to lie flat on the grid
            const centerCellMaterial = new THREE.MeshBasicMaterial({
                color: 0xFFFF00, // Yellow
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.5
            });
            const centerCell = new THREE.Mesh(centerCellGeometry, centerCellMaterial);
            centerCell.position.set(0, 0, 0); // Position at center of grid
            self.scene.add(centerCell);


            // Add direction arrow
            const arrow = this.createArrow();
            self.scene.add(arrow);

            // Transparent Lego guide
            self.hoverLegoGeometry = new THREE.BoxGeometry(self.LegoDimensions.Width, self.LegoDimensions.Height, self.LegoDimensions.Depth);
            self.hoverLegoMaterial = new THREE.MeshBasicMaterial({ color: self.LegoColors.Green, opacity: 0.5, transparent: true });
            self.hoverLegoMesh = new THREE.Mesh(self.hoverLegoGeometry, self.hoverLegoMaterial);
            self.scene.add(self.hoverLegoMesh);

            // Lego brick
            self.legoGeometry = new THREE.BoxGeometry(self.LegoDimensions.Width, self.LegoDimensions.Height, self.LegoDimensions.Depth);

            // Grid
            const gridHelper = new THREE.GridHelper(900, 9, self.Colors.White, self.Colors.Blue1);
            self.scene.add(gridHelper);

            // Raycaster
            self.raycaster = new THREE.Raycaster(); // what objects in the 3D space the mouse is over
            self.pointer = new THREE.Vector2(); // mouse position in 2D space

            // Invisible plane of coordinates to track mouse position
            const planeGeometry = new THREE.PlaneGeometry(900, 900); // same as grid size
            // default orientation of the plane is XY, but we want it to be XZ, parallel to the grid
            planeGeometry.rotateX(- Math.PI / 2); // rotate plane 90 degrees counterclockwise around the x-axis
            const planeMaterial = new THREE.MeshBasicMaterial({ visible: false })
            plane = new THREE.Mesh(planeGeometry, planeMaterial);
            self.scene.add(plane);

            // Add plane to objects array so that raycaster can consider it when performing intersection checks
            self.objects.push(plane);

            // Lighting
            // Ambient light - lights up all objects in the scene
            const ambientLight = new THREE.AmbientLight(self.Colors.Gray, 2);
            self.scene.add(ambientLight);

            // Directional light - light source at an angle
            const directionalLight = new THREE.DirectionalLight(self.Colors.White, 3);
            directionalLight.position.set(1, 0.75, 0.5).normalize();
            self.scene.add(directionalLight);

            // Renderer
            self.renderer = new THREE.WebGLRenderer({ antialias: true });
            self.renderer.setPixelRatio(window.devicePixelRatio);

            var container = document.getElementById('canvas-container')
            container.appendChild(self.renderer.domElement);
            const rect = container.getBoundingClientRect();
            self.camera.aspect = rect.width  / rect.height;
            self.camera.updateProjectionMatrix();
            self.renderer.setSize(rect.width, rect.height);
            self.render();


        };

      this.createArrow = function () {
        // Create arrow group
        const arrowGroup = new THREE.Group();

        // Create arrow shaft
        const shaftGeometry = new THREE.BoxGeometry(100, 10, 5);
        const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red color
        const shaft = new THREE.Mesh(shaftGeometry, arrowMaterial);

        // Create arrow head
        const headGeometry = new THREE.ConeGeometry(15, 30, 32);
        const head = new THREE.Mesh(headGeometry, arrowMaterial);
        head.position.x = -65; // Position at end of shaft
        head.rotation.z = Math.PI / 2; // Rotate to point in right direction

        // Add shaft and head to group
        arrowGroup.add(shaft);
        arrowGroup.add(head);

        // Position the entire arrow
        arrowGroup.position.set(0, 0, 550); // Place outside grid, towards camera
        arrowGroup.rotation.y = - Math.PI /  2; // Point towards center

        return arrowGroup;
}

        this.render = function() {
            self.renderer.render(self.scene, self.camera)
        };

        this.onPointerMove = function(event) {
            if (!self.isShiftKeyDown) self.hoverLegoMesh.visible = true;

            container = document.getElementById('canvas-container');

            // Calculate normalized coordinates of the pointer within the window
            // const pointerNormalizedXCoord = (event.clientX / container_width) * 2 - 1
            // const pointerNormalizedYCoord = - (event.clientY / container_height) * 2 + 1
            // Set the pointer vector with the normalized coordinates
            //pointer.set(pointerNormalizedXCoord, pointerNormalizedYCoord);


            // Calculate the canvas container's bounding rectangle
            const canvasContainer = document.getElementById('canvas-container');
            const rect = canvasContainer.getBoundingClientRect();

            // Calculate normalized coordinates of the pointer within the canvas
            const pointerNormalizedXCoord =
                ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const pointerNormalizedYCoord =
               -((event.clientY - rect.top) / rect.height) * 2 + 1;

            // Set the pointer vector with the normalized coordinates
            self.pointer.set(pointerNormalizedXCoord, pointerNormalizedYCoord);


            // Cast a ray from the camera to the pointer
            self.raycaster.setFromCamera(self.pointer, self.camera);
            // Check for intersections between the ray projected from the pointer and the objects
            const intersections = self.raycaster.intersectObjects(self.objects, false);

            if (intersections.length > 0) {
                // Get the first intersection
                const intersect = intersections[0];

                // Set the position of the 'hoverLegoMesh' to snap to the nearest grid intersection
                self.hoverLegoMesh.position.copy(intersect.point).add(intersect.face.normal); // Sets the position of hoverLegoMesh to the intersection point, add() creates slight hovering effect
                self.hoverLegoMesh.position.divideScalar(100).floor().multiplyScalar(100);
                self.hoverLegoMesh.position.y += 50;
                // Render to visualize the changes
                self.render();
            }
        }

        this.onPointerDown = function(event) {
            // Ignore right clicks and if orbit controls are enabled
            // if (event.button !== 0 || orbitControlsEnabled) return;

            // Calculate normalized coordinates of the mouse pointer within the window
            container = document.getElementById('canvas-container');
            const container_width = $(container).width()
            const container_height = $(container).height()
            const pointerNormalizedXCoord = (event.clientX / window.innerWidth) * 2 - 1
            const pointerNormalizedYCoord = - (event.clientY / window.innerHeight) * 2 + 1
            // Set the pointer vector with the normalized coordinates
            //pointer.set(pointerNormalizedXCoord, pointerNormalizedYCoord);

            // Calculate the canvas container's bounding rectangle
            const canvasContainer = document.getElementById('canvas-container');
            const rect = canvasContainer.getBoundingClientRect();

            // Calculate normalized coordinates of the pointer within the canvas
            //const pointerNormalizedXCoord =
            //    ((event.clientX - rect.left) / rect.width) * 2 - 1;
            //const pointerNormalizedYCoord =
            //    -((event.clientY - rect.top) / rect.height) * 2 + 1;

            // Cast a ray from the camera to the pointer
            self.raycaster.setFromCamera(self.pointer, self.camera);
            // Check for intersections between the ray projected from the pointer and the objects
            const intersections = self.raycaster.intersectObjects(self.objects, false);

            if (intersections.length > 0) {
                // Get the first intersection
                const intersect = intersections[0];

                // Check if shift key is pressed
                if (self.isShiftKeyDown) {
                    // Remove lego brick at intersection point
                    if (intersect.object !== self.plane) {
                        self.scene.remove(intersect.object);
                        self.objects.splice(self.objects.indexOf(intersect.object), 1);
                    }
                } else {
                    // Create a lego brick with the selected color
                    const legoMaterial = new THREE.MeshLambertMaterial({ color: self.params.color});
                    legoBrick = new THREE.Mesh(self.legoGeometry, legoMaterial);
                    // Set the position of the new Lego brick at the nearest grid intersection
                    legoBrick.position.copy(intersect.point).add(intersect.face.normal);
                    legoBrick.position.divideScalar(100).floor().multiplyScalar(100);
                    legoBrick.position.y += 50;
                    self.scene.add(legoBrick);

                    // Add the new Lego brick to the objects array for raycaster to consider it when performing intersection checks
                    self.objects.push(legoBrick);
                    //self.blocks.push({position: legoBrick.position.toArray(), color: self.params.selectedColor});
                }
                // Render to visualize the changes
                self.render();
            }
        }

        this.load_existing_structure = function (blocks){
             // Create a lego brick with the selected color
             for (var i = 0; i < blocks.length; i++) {
                 legoMaterial = new THREE.MeshLambertMaterial({ color:self.LegoColors[blocks[i].color]});
                 var legoBrick = new THREE.Mesh(self.legoGeometry, legoMaterial);

                 legoBrick.position.set(blocks[i].position[0], blocks[i].position[1], blocks[i].position[2])
                 self.scene.add(legoBrick);
                 // Add the new Lego brick to the objects array for raycaster to consider it when performing intersection checks
                 self.objects.push(legoBrick);
             }
             self.render();



        }

        this.load = function(callback){
            var subListMap = self.subListMap;

            if(self.questionId != null){
                $http.get("/getQuestion/" + self.questionId).success(function (data) {
                    self.questions = [data];

                    subListMap[self.questions[0].subList] = [self.questions[0]];

                    if(callback !== undefined){
                        callback();
                    }
                });
            }else if(self.partId != null){
                $http.get("/returnPart?partId=" + self.partId).success(function (data) {
                    var json = data;
                    self.part = json;
                    self.questions = json.questions;

                    if(self.shuffleQuestions){
                        shuffleArray(self.part.questions);
                    }

                    for(var i = 0; i < self.questions.length; ++i){
                        var q = self.questions[i];
                        if (subListMap.hasOwnProperty(q.subList)){
                            subListMap[q.subList].push(q);
                        }else{
                            subListMap[q.subList] = [q];
                            self.subListsIds.push(q.subList);
                        }
                    }
                    if(self.shuffleSublists){
                        shuffleArray(self.subListsIds);
                    }
                    self.questions = self.subListMap[self.subListsIds[0]];

                    if(callback !== undefined){
                        callback();
                    }
                });
            }else{
                $http.get("/getPart?expId=" + self.expId + "&workerId=" + self.workerId).success(function (data) {
                    var json = data;
                    self.part = json;
                    self.partId = json.id;
                    self.questions = json.questions;

                    if(self.shuffleQuestions){
                        shuffleArray(self.part.questions);
                    }

                    for(var i = 0; i < self.questions.length; ++i){
                        var q = self.questions[i];
                        if (subListMap.hasOwnProperty(q.subList)){
                            subListMap[q.subList].push(q);
                        }else{
                            subListMap[q.subList] = [q];
                            self.subListsIds.push(q.subList);
                        }
                    }
                    if(self.shuffleSublists){
                        shuffleArray(self.subListsIds);
                    }
                    self.questions = self.subListMap[self.subListsIds[0]];

                    if(callback !== undefined){
                        callback();
                    }
                });
            }
        };

        $(document).ready(function () {
            self.questionId = ($("#questionId").length > 0) ? $("#questionId").val() : null;
            self.partId = ($("#partId").length > 0) ? $("#partId").val() : null;
            self.expId = ($("#expId").length > 0) ? $("#expId").val() : null;
            self.hitId = ($("#hitId").length > 0) ? $("#hitId").val() : "NOT AVAILABLE";
            self.workerId = ($("#workerId").length > 0) ? $("#workerId").val() : "";
            self.assignmentId = ($("#assignmentId").length > 0) ? $("#assignmentId").val() : "NOT AVAILABLE";
            self.origin = ($("#origin").length > 0) ? $("#origin").val() : "NOT AVAILABLE";
            self.redirectUrl = ($("#redirectUrl").length > 0) ? $("#redirectUrl").val() : null;

            if(self.questionId != null || self.partId != null){
                self.load();
            }
            self.allStates = ["instructionsSlide","workerIdSlide","statisticsSlide","questionSlide"];

            if(!self.useStatistics){
                var index = self.allStates.indexOf("statisticsSlide");
                self.allStates.splice(index,1);
            }

            if(self.workerId.trim() != ""){
                var index = self.allStates.indexOf("workerIdSlide");
                self.allStates.splice(index,1);
            }


            $scope.$apply(self.state = self.allStates[0]);

            $(document).on("keypress", ":input:not(textarea)", function(event) {
                if (event.keyCode == 13) {
                    event.preventDefault();
                }
            });
        });
    }]);
})();


