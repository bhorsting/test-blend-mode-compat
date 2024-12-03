import {execSync} from "child_process";
import fs from "fs";
import puppeteer from "puppeteer";
import {PNG} from "pngjs";
import pixelmatch from "pixelmatch";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {bottom} from "./input/bottom.js";
import {top} from "./input/top.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const blendModes = [
    "normal",
    "multiply",
    "screen",
    "overlay",
    "darken",
    "lighten",
    "color-dodge",
    "color-burn",
    "hard-light",
    "soft-light",
    "difference",
    "exclusion",
    "hue",
    "saturation",
    "color",
    "luminosity",
];

const inputFolder = "input";
const outputFolder = "output";
const bottomImage = `${inputFolder}/bottom.png`;
const topImage = `${inputFolder}/top.png`;

if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder);
}

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    for (const mode of blendModes) {
        console.log(`Processing blend mode: ${mode}`);

        // Step 1: Apply blend mode with FFmpeg
        const ffmpegOutput = `${outputFolder}/${mode}_ffmpeg.png`;
        try {
            const command = `ffmpeg -i ${ bottomImage} -i ${ topImage} -filter_complex "[0:v][1:v]blend=all_mode=${mode}" -y ${ffmpegOutput}`;
            console.log(command);
            execSync(
                command,
            );
        } catch (error) {
            console.error(`FFmpeg failed for mode ${mode}:`, error.message);
            continue;
        }

        // Step 2: Generate HTML for CSS blend mode
        const htmlContent = `
      <html>
        <head>
            <style>
                body {
                    margin: 0;
                  width:500px; 
                  height: 500px; 
                  background: black;
                }
                img {
                position: absolute;
                    top:0;
                }
            </style>
        </head>
        <body>
          <div style="position:relative;width:500px;height:500px;">
            <img src="${bottom}" style="position:absolute;top:0;left:0;width:100%;height:100%;">
            <img src="${top}" style="position:absolute;top:0;left:0;width:100%;height:100%;mix-blend-mode:${mode};">
          </div>
        </body>
      </html>
    `;
        const htmlPath = `${outputFolder}/${mode}.html`;
        fs.writeFileSync(htmlPath, htmlContent);

        // Step 3: Screenshot the HTML file
        await page.setContent(htmlContent, {waitUntil: "networkidle0"});
        const cssOutput = `${outputFolder}/${mode}_css.png`;
        await page.setViewport({width: 500, height: 500});
        await page.screenshot({path: cssOutput, clip: {x: 0, y: 0, width: 500, height: 500}});

        // Step 4: Diff the images
        const ffmpegImg = PNG.sync.read(fs.readFileSync(ffmpegOutput));
        const cssImg = PNG.sync.read(fs.readFileSync(cssOutput));
        const {width, height} = ffmpegImg;
        const diff = new PNG({width, height});
        const diffPixels = pixelmatch(
            ffmpegImg.data,
            cssImg.data,
            diff.data,
            width,
            height,
            {threshold: 0.1}
        );
        const diffOutput = `${outputFolder}/${mode}_diff.png`;
        fs.writeFileSync(diffOutput, PNG.sync.write(diff));
        console.log(`${mode}: Diff pixels count = ${diffPixels}`);
    }

    await browser.close();
})();
