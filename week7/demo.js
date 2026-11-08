/* Shared WebGL helpers for the week 7 ray-tracing exercises. */
(() => {
  'use strict';
  const D = {};

  D.context = canvas => canvas.getContext('webgl2', { antialias: false, alpha: false });

  D.program = (gl, vertexSource, fragmentSource) => {
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message || 'Shader compilation failed');
      }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(message || 'Program link failed');
    }
    return program;
  };

  D.uniforms = (gl, program, names) => Object.fromEntries(
    names.map(name => [name, gl.getUniformLocation(program, name)])
  );

  D.fullscreen = (gl, program) => {
    gl.useProgram(program);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  D.sphere = (segments = 28) => {
    const positions = [], normals = [], indices = [];
    const around = segments * 2, width = around + 1;
    for (let i = 0; i <= segments; i++) {
      const phi = Math.PI * i / segments;
      for (let j = 0; j <= around; j++) {
        const theta = 2 * Math.PI * j / around;
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.cos(phi);
        const z = Math.sin(phi) * Math.sin(theta);
        positions.push(x, y, z);
        normals.push(x, y, z);
      }
    }
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < around; j++) {
        const a = i * width + j, b = a + width;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      indices: new Uint16Array(indices)
    };
  };

  D.mesh = (gl, data) => {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const position = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, position);
    gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    if (data.normals) {
      const normal = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, normal);
      gl.bufferData(gl.ARRAY_BUFFER, data.normals, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    }
    const index = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: data.indices.length };
  };

  D.M4 = {
    identity: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    multiply(a, b) {
      const out = new Float32Array(16);
      for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
          out[col * 4 + row] =
            a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] +
            a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
        }
      }
      return out;
    },
    model(position, scale) {
      const m = D.M4.identity();
      m[0] = scale[0]; m[5] = scale[1]; m[10] = scale[2];
      m[12] = position[0]; m[13] = position[1]; m[14] = position[2];
      return m;
    },
    perspective(fov, aspect, near, far) {
      const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
      return new Float32Array([
        f / aspect, 0, 0, 0, 0, f, 0, 0,
        0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0
      ]);
    },
    lookAt(eye, target, up) {
      const normalize = v => {
        const length = Math.hypot(...v) || 1;
        return v.map(value => value / length);
      };
      const subtract = (a, b) => a.map((v, i) => v - b[i]);
      const cross = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
      ];
      const z = normalize(subtract(eye, target));
      const x = normalize(cross(up, z));
      const y = cross(z, x);
      return new Float32Array([
        x[0], y[0], z[0], 0, x[1], y[1], z[1], 0,
        x[2], y[2], z[2], 0, -x.reduce((s, v, i) => s + v * eye[i], 0),
        -y.reduce((s, v, i) => s + v * eye[i], 0),
        -z.reduce((s, v, i) => s + v * eye[i], 0), 1
      ]);
    }
  };

  globalThis.Week7 = D;
})();
