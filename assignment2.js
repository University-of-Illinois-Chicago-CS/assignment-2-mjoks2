import vertexShaderSrc from './vertex.glsl.js';
import fragmentShaderSrc from './fragment.glsl.js'

var gl = null;
var vao = null;
var program = null;
var vertexCount = 0;
var uniformModelViewLoc = null;
var uniformProjectionLoc = null;
var heightmapData = null;

function processImage(img)
{
	// draw the image into an off-screen canvas
	var off = document.createElement('canvas');
	
	var sw = img.width, sh = img.height;
	off.width = sw; off.height = sh;
	
	var ctx = off.getContext('2d');
	ctx.drawImage(img, 0, 0, sw, sh);
	
	// read back the image pixel data
	var imgd = ctx.getImageData(0,0,sw,sh);
	var px = imgd.data;
	
	// create a an array will hold the height value
	var heightArray = new Float32Array(sw * sh);
	
	// loop through the image, rows then columns
	for (var y=0;y<sh;y++) 
	{
		for (var x=0;x<sw;x++) 
		{
			// offset in the image buffer
			var i = (y*sw + x)*4;
			
			// read the RGB pixel value
			var r = px[i+0], g = px[i+1], b = px[i+2];
			
			// convert to greyscale value between 0 and 1
			var lum = (0.2126*r + 0.7152*g + 0.0722*b) / 255.0;

			// store in array
			heightArray[y*sw + x] = lum;
		}
	}

	return {
		data: heightArray,
		width: sw,
		height: sw
	};
}

function createMesh() {
	if(!heightmapData){
		console.log("Missing heightmapData in createMesh()");
		return null;
	}

    var width = heightmapData.width;
    var height = heightmapData.height;
    var data = heightmapData.data;

    var totalVerts = (width - 1) * (height - 1) * 6;
    var positions = new Float32Array(totalVerts * 3);
	let pos = 0;

	for (let j = 0; j < height - 1; j++) {
        for (let i = 0; i < width - 1; i++) {
			// z for this row and the next row
        	var z0 =  (j / (height - 1)) - 0.5;
        	var z1 = ((j + 1) / (height - 1)) - 0.5;

            // x for this col and next col
            var x0 =  (i / (width - 1)) - 0.5;
            var x1 = ((i + 1) / (width - 1)) - 0.5;

            // sample heights (row-major in data[])
            var y00 = data[(j * width) + i];
            var y10 = data[(j * width) + (i + 1)];
            var y01 = data[(j + 1) * width + i];
            var y11 = data[(j + 1) * width + (i + 1)];

            // Triangle 1: (i,j) -> (i+1,j) -> (i,j+1)
            positions[pos++] = x0; positions[pos++] = y00; positions[pos++] = z0;
            positions[pos++] = x1; positions[pos++] = y10; positions[pos++] = z0;
            positions[pos++] = x0; positions[pos++] = y01; positions[pos++] = z1;

            // Triangle 2: (i+1,j) -> (i+1,j+1) -> (i,j+1)
            positions[pos++] = x1; positions[pos++] = y10; positions[pos++] = z0;
            positions[pos++] = x1; positions[pos++] = y11; positions[pos++] = z1;
            positions[pos++] = x0; positions[pos++] = y01; positions[pos++] = z1;
        }
    }

	return positions;
}

function uploadMesh(positions){
	if(!positions){
		console.log("Missing positions in uploadMesh()");
	}

	const posBuffer = createBuffer(gl, gl.ARRAY_BUFFER, positions);
    const posAttribLoc = gl.getAttribLocation(program, "position");
    vao = createVAO(gl, posAttribLoc, posBuffer);

    vertexCount = positions.length / 3;
}


window.loadImageFile = function(event)
{

	var f = event.target.files && event.target.files[0];
	if (!f) return;
	
	// create a FileReader to read the image file
	var reader = new FileReader();
	reader.onload = function() 
	{
		// create an internal Image object to hold the image into memory
		var img = new Image();
		img.onload = function() 
		{
			// heightmapData is globally defined
			heightmapData = processImage(img);
			
			/*
				TODO: using the data in heightmapData, create a triangle mesh
					heightmapData.data: array holding the actual data, note that 
					this is a single dimensional array the stores 2D data in row-major order

					heightmapData.width: width of map (number of columns)
					heightmapData.height: height of the map (number of rows)
			*/

			var positions = createMesh();
			uploadMesh(positions);

			console.log('loaded image: ' + heightmapData.width + ' x ' + heightmapData.height);
		};
		img.onerror = function() 
		{
			console.error("Invalid image file.");
			alert("The selected file could not be loaded as an image.");
		};

		// the source of the image is the data load from the file
		img.src = reader.result;
	};
	reader.readAsDataURL(f);
}


function setupViewMatrix(eye, target)
{
    var forward = normalize(subtract(target, eye));
    var upHint  = [0, 1, 0];

    var right = normalize(cross(forward, upHint));
    var up    = cross(right, forward);

    var view = lookAt(eye, target, up);
    return view;

}
function draw()
{

	var fovRadians = 70 * Math.PI / 180;
	var aspectRatio = +gl.canvas.width / +gl.canvas.height;
	var nearClip = 0.001;
	var farClip = 20.0;
	var matrix; 

	if (document.querySelector("#projection").value == 'perspective'){
		// perspective projection
		matrix = perspectiveMatrix(
			fovRadians,
			aspectRatio,
			nearClip,
			farClip,
		);
	}else{
		let left = -2.5 * aspectRatio;
		let right = 2.5 * aspectRatio;
		let bottom = -2.5;
		let top = 2.5;

		matrix = orthographicMatrix(left, right, bottom, top, nearClip, farClip);
	}

	// eye and target
	var eye = [0, 5, 5];
	var target = [0, 0, 0];

	var viewMatrix = setupViewMatrix(eye, target);
	var modelMatrix = identityMatrix();

	// TODO: set up transformations to the model

	// Read rotation, scale and height values from sliders
	var yRotation = (parseFloat(document.querySelector("#yrotation").value) * Math.PI) / 180;
	var zRotation = (parseFloat(document.querySelector("#zrotation").value) * Math.PI) / 180;
	var scaleValue = (parseFloat(document.querySelector("#scale").value)) / 10.0;
	var heightValue = parseFloat(document.querySelector("#height").value) / 15.0;

	// Get new points based on rotation values
	var yMatrix = rotateYMatrix(yRotation);
	var zMatrix = rotateZMatrix(zRotation);
	modelMatrix = multiplyMatrices(yMatrix, zMatrix);

	// Scale terrain based on height slider
	var heightMatrix = scaleMatrix(1, heightValue, 1);
	modelMatrix = multiplyMatrices(modelMatrix, heightMatrix);

	// Zoom in on object based on scale value
	var scaleMatrixObj = scaleMatrix(scaleValue, scaleValue, scaleValue);
	modelMatrix = multiplyMatrices(modelMatrix, scaleMatrixObj);

	var modelviewMatrix = multiplyMatrices(viewMatrix, modelMatrix);

	// setup viewing matrix
	var eyeToTarget = subtract(target, eye);
	var viewMatrix = setupViewMatrix(eye, target);

	// model-view Matrix = view * model
	var modelviewMatrix = multiplyMatrices(viewMatrix, modelMatrix);


	// enable depth testing
	gl.enable(gl.DEPTH_TEST);

	// disable face culling to render both sides of the triangles
	gl.disable(gl.CULL_FACE);

	gl.clearColor(0.2, 0.2, 0.2, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);

	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.useProgram(program);
	
	// update modelview and projection matrices to GPU as uniforms
	gl.uniformMatrix4fv(uniformModelViewLoc, false, new Float32Array(modelviewMatrix));
	gl.uniformMatrix4fv(uniformProjectionLoc, false, new Float32Array(matrix));

	gl.bindVertexArray(vao);
	
	var primitiveType = gl.TRIANGLES;
	gl.drawArrays(primitiveType, 0, vertexCount);

	requestAnimationFrame(draw);

}

function createBox()
{
	function transformTriangle(triangle, matrix) {
		var v1 = [triangle[0], triangle[1], triangle[2], 1];
		var v2 = [triangle[3], triangle[4], triangle[5], 1];
		var v3 = [triangle[6], triangle[7], triangle[8], 1];

		var newV1 = multiplyMatrixVector(matrix, v1);
		var newV2 = multiplyMatrixVector(matrix, v2);
		var newV3 = multiplyMatrixVector(matrix, v3);

		return [
			newV1[0], newV1[1], newV1[2],
			newV2[0], newV2[1], newV2[2],
			newV3[0], newV3[1], newV3[2]
		];
	}

	var box = [];

	var triangle1 = [
		-1, -1, +1,
		-1, +1, +1,
		+1, -1, +1,
	];
	box.push(...triangle1)

	var triangle2 = [
		+1, -1, +1,
		-1, +1, +1,
		+1, +1, +1
	];
	box.push(...triangle2);

	// 3 rotations of the above face
	for (var i=1; i<=3; i++) 
	{
		var yAngle = i* (90 * Math.PI / 180);
		var yRotMat = rotateYMatrix(yAngle);

		var newT1 = transformTriangle(triangle1, yRotMat);
		var newT2 = transformTriangle(triangle2, yRotMat);

		box.push(...newT1);
		box.push(...newT2);
	}

	// a rotation to provide the base of the box
	var xRotMat = rotateXMatrix(90 * Math.PI / 180);
	box.push(...transformTriangle(triangle1, xRotMat));
	box.push(...transformTriangle(triangle2, xRotMat));


	return {
		positions: box
	};

}

var isDragging = false;
var startX, startY;
var leftMouse = false;

function addMouseCallback(canvas)
{
	isDragging = false;

	canvas.addEventListener("mousedown", function (e) 
	{
		if (e.button === 0) {
			console.log("Left button pressed");
			leftMouse = true;
		} else if (e.button === 2) {
			console.log("Right button pressed");
			leftMouse = false;
		}

		isDragging = true;
		startX = e.offsetX;
		startY = e.offsetY;
	});

	canvas.addEventListener("contextmenu", function(e)  {
		e.preventDefault(); // disables the default right-click menu
	});


	canvas.addEventListener("wheel", function(e)  {
		e.preventDefault(); // prevents page scroll

		if (e.deltaY < 0) 
		{
			console.log("Scrolled up");
			// e.g., zoom in
		} else {
			console.log("Scrolled down");
			// e.g., zoom out
		}
	});

	document.addEventListener("mousemove", function (e) {
		if (!isDragging) return;
		var currentX = e.offsetX;
		var currentY = e.offsetY;

		var deltaX = currentX - startX;
		var deltaY = currentY - startY;
		console.log('mouse drag by: ' + deltaX + ', ' + deltaY);

		// implement dragging logic
	});

	document.addEventListener("mouseup", function () {
		isDragging = false;
	});

	document.addEventListener("mouseleave", () => {
		isDragging = false;
	});
}

function initialize() 
{
	var canvas = document.querySelector("#glcanvas");
	canvas.width = canvas.clientWidth;
	canvas.height = canvas.clientHeight;

	gl = canvas.getContext("webgl2");

	// add mouse callbacks
	addMouseCallback(canvas);

	var box = createBox();
	vertexCount = box.positions.length / 3;		// vertexCount is global variable used by draw()
	console.log(box);

	// create buffers to put in box
	var boxVertices = new Float32Array(box['positions']);
	var posBuffer = createBuffer(gl, gl.ARRAY_BUFFER, boxVertices);

	var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSrc);
	var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSrc);
	program = createProgram(gl, vertexShader, fragmentShader);

	// attributes (per vertex)
	var posAttribLoc = gl.getAttribLocation(program, "position");

	// uniforms
	uniformModelViewLoc = gl.getUniformLocation(program, 'modelview');
	uniformProjectionLoc = gl.getUniformLocation(program, 'projection');

	vao = createVAO(gl, 
		// positions
		posAttribLoc, posBuffer, 

		// normals (unused in this assignments)
		null, null, 

		// colors (not needed--computed by shader)
		null, null
	);

	window.requestAnimationFrame(draw);
}

window.onload = initialize();