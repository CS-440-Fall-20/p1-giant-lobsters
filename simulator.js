"use strict";

var canvas;
var gl;

var points = [];
var normals = [];
var colours = []; //remove when come to shading?

var vBuffer;
var colour_buffer;

var near = -10;
var far = 10;
var radius = 3;
var theta = 48.5;
var phi = 54.0;

var left = -3.0;
var right = 3.0;
var ytop = 3.0;
var bottom = -3.0;

var wireframe = true;

var modelViewMatrix, projectionMatrix;
var modelViewMatrixLoc, projectionMatrixLoc;

var normalMatrix, normalMatrixLoc;

var eye;
var position_vector = vec3(0.0, 0.0, 0.0);
var up_vector = vec3(0.0, 1.0, 0.0);


var speed = 0;
var flying_offset = 0;
var minAltitude = -0.5; // min altitude
var maxAltitude = 0.5; // max altitude
var S = 0.1; // max speed

var color = vec4(1, 1, 1, 1);


var scale = 0.1; //arbitary scling factor for wireframe



window.onload = function init() {

    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    gl.enable(gl.DEPTH_TEST);

    //
    //  Load shaders and initialize attribute buffers
    //
    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    /*
        var nBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);
        var vNormal = gl.getAttribLocation(program, "vNormal");
        gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vNormal);*/
    get_patch(-5, 5, -10, 10);

    vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
    // normalMatrixLoc = gl.getUniformLocation(program, "normalMatrix");


    // Load colours data into the GPU
    colour_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colour_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colours), gl.STATIC_DRAW);

    var vColour = gl.getAttribLocation(program, "vColour");
    gl.vertexAttribPointer(vColour, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColour);


    document.body.onkeydown = function (event) {
        event = event || window.event;
        var keycode = event.code;
        var shiftPressed = false;

        if (event.shiftKey) { shiftPressed = true; }

        varyView(keycode, shiftPressed);
        FlightMotion(keycode);
    }
    render();
}

function get_patch(xmin, xmax, zmin, zmax) {

    noise.seed(10);

    for (var i = xmin; i < xmax; i += scale) {
        for (var j = zmin; j < zmax; j += scale) {
            //basic mesh  
            points.push(vec3(i, 0, j + scale));
            points.push(vec3(i, 0, j));
            points.push(vec3(i + scale, 0, j));
            points.push(vec3(i, 0, j + scale));
            points.push(vec3(i + scale, 0, j + scale));
            points.push(vec3(i, 0, j + scale));

            colours.push(color);
            colours.push(color);
            colours.push(color);

            colours.push(color);
            colours.push(color);
            colours.push(color);

        }
        //randomly perturb y-coordinates - using perlin noise
        for (var k = 0; k < points.length; k++) {
            points[k][1] = noise.perlin2(points[k][0], points[k][2]);
        }
    }
}



function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // adding the speed to the offset for perlin noise.
    flying_offset += speed;

    //Using perlin noise to get a smooth terrain
    noise.seed(10);
    for (var k = 0; k < points.length; k++) {
        points[k][1] = noise.perlin2(points[k][0]-flying_offset, points[k][2]);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
    // gl.bindBuffer( gl.ARRAY_BUFFER, colour_buffer );
    // gl.bufferData( gl.ARRAY_BUFFER, flatten(colours), gl.STATIC_DRAW );

    //Flyby View
    eye = vec3(radius * Math.sin(theta) * Math.cos(phi), radius * Math.sin(theta) * Math.sin(phi), radius * Math.cos(theta));

    modelViewMatrix = lookAt(eye, position_vector, up_vector);
    projectionMatrix = ortho(left, right, bottom, ytop, near, far);

    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

    if (wireframe) {
        gl.drawArrays(gl.LINES, 0, points.length);
    }

    window.requestAnimFrame(render);
}


/// ADD: Quit simulation later (esc key)
function varyView(keycode, shiftPressed) {
    var mode = (shiftPressed == true) ? "add" : "minus";

    if (keycode === "Digit1") //1 or Shift+1
    {
        varyLeft(mode);
    }
    else if (keycode === "Digit2") //2 or Shift+2
    {
        varyRight(mode);
    }
    else if (keycode === "Digit3") //3 or Shift+3
    {
        varyTop(mode);
    }
    else if (keycode === "Digit4")//4 or Shift+4
    {
        varyBottom(mode);
    }
    else if (keycode === "Digit5")//5 or Shift+5
    {
        varyNear(mode);
    }
    else if (keycode === "Digit6") //6 or Shift+6
    {
        varyFar(mode);
    }
}

/* vary view */
function varyLeft(mode) {
    if (mode === "add") {
        left += 0.01;
    }
    else {
        left -= 0.01;
    }
}

function varyRight(mode) {
    if (mode == "add") {
        right += 0.01;
    }
    else {
        right -= 0.01;
    }
}

function varyTop(mode) {
    if (mode == "add") {
        ytop += 0.01;
    }
    else {
        ytop -= 0.01;
    }
}

function varyBottom(mode) {
    if (mode == "add") {
        bottom += 0.01;
    }
    else {
        bottom -= 0.01;
    }
}

function varyNear(mode) {
    if (mode == "add") {
        near += 1;
    }
    else {
        near -= 1;
    }
}

function varyFar(mode) {
    if (mode == "add") {
        far += 0.01;
    }
    else {
        far -= 0.01;
    }
}


// ********************************************* Flight Controls *******************************************

function FlightMotion(e) {
    console.log(e)

    if (e == "ArrowUp")   //Speed Increase 
    {
        if (speed < S)
            speed += 0.001;
    }
    else if (e == "ArrowDown")   //Speed Decrease
    {
        if (speed > 0)
            speed -= 0.001;
    }
    else if (e == "KeyW")   //Pitch-Up
    {
        if (position_vector[1] <= maxAltitude) {
            position_vector[1] += 0.01;
        }
    }
    else if (e == "KeyS")   //Pitch-Down
    {
        if (position_vector[1] >= minAltitude)
            position_vector[1] -= 0.01;
    }
    else if (e == "KeyA")   //Yaw-Right
    {
        if (position_vector[2] <= 1.0)
            position_vector[2] += 0.01;
    }
    else if (e == "KeyD")   //Yaw-Left
    {
        if (position_vector[2] >= -1.0)
            position_vector[2] -= 0.01;
    }
    else if (e == "KeyQ")   //Roll-Clockwise
    {
        if (up_vector[2] <= 1.0)
            up_vector[2] += 0.01;
    }
    else if (e == "KeyE")   //Roll-Counter Clockwise
    {
        if (up_vector[2] >= -1.0)
            up_vector[2] -= 0.01;
    }
}


/* References */
//  perlin.js used for perlin noise 
