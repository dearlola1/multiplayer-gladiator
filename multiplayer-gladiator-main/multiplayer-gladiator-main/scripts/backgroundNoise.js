const canvas = document.getElementById('noiseCanvas');
const ctx = canvas.getContext('2d');
const simplex = new SimplexNoise();

const width = canvas.width;
const height = canvas.height;
const imageData = ctx.createImageData(width, height);

let time = 0;

function animateNoise() {
    time += 0.001;

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            let value = simplex.noise3D(x * 0.008, y * 0.008, time);

            const scaledValue = (value + 1) / 2;

            // Adjust the ratio of blue to white further
            const r = 15 + (50 * scaledValue);  // Significantly reduce red contribution
            const g = 15 + (50 * scaledValue);  // Significantly reduce green contribution
            const b = 60 + (180 * scaledValue); // Keep blue more prominent

            const index = (x + y * width) * 4;
            imageData.data[index] = r;
            imageData.data[index + 1] = g;
            imageData.data[index + 2] = b;
            imageData.data[index + 3] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    requestAnimationFrame(animateNoise);
}

animateNoise();
