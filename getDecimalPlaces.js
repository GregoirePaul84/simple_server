function getDecimalPlaces(stepSize) {
    const stepSizeStr = stepSize.toString();
    if (stepSizeStr.indexOf('.') === -1) return 0;
    return stepSizeStr.split('.')[1].length;
}

module.exports = { getDecimalPlaces };
