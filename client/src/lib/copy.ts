import { toast } from '@/components/ui/toaster';

/**
 * The copy affordances, which actually work.
 *
 * The approved mock had these inert. A button that looks like it copied and did
 * not is worse than no button, so every one of these confirms — and says so
 * plainly when the browser refuses.
 */
export async function copyText(text: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} copied`);
  } catch {
    toast(`${what} could not be copied — the browser refused clipboard access`);
  }
}

/**
 * Rasterises a chart to PNG.
 *
 * Recharts renders inline SVG, which references the page's CSS for its type and
 * rules. Serialised on its own it would lose all of that, so the fonts and
 * strokes are inlined before the SVG goes near a canvas.
 */
export async function downloadChartPng(svg: SVGSVGElement, filename: string): Promise<void> {
  try {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const { width, height } = svg.getBoundingClientRect();

    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `
      text { font-family: 'IBM Plex Mono', monospace; font-size: 10px; fill: #948880 }
      .recharts-cartesian-grid line { stroke: #2E2722 }
      .recharts-cartesian-axis-line, .recharts-cartesian-axis-tick-line { stroke: #453B33 }
    `;
    clone.insertBefore(style, clone.firstChild);

    const source = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The chart could not be rendered.'));
      image.src = url;
    });

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('No canvas context.');

    // The page ground, so the PNG is not a chart floating on transparency.
    context.fillStyle = '#1B1714';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();

    toast('Chart downloaded');
  } catch {
    toast('The chart could not be downloaded');
  }
}
