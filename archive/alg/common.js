function interpolateColor(value) {
    const r = Math.floor(value * 2.55);
    const g = 255 - r;
    return `rgb(${r}, ${g}, 0)`;
}