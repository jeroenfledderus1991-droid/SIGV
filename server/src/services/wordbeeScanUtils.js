const FILTER_SCAN_MULTIPLIER = 12;
const FILTER_SCAN_MIN_ROWS = 1500;
const FILTER_SCAN_MAX_ROWS = 8000;
const FILTER_SCAN_DEFAULT_ROWS = 5000;

function resolveFilterScanLimit(maxRowsValue) {
  if (maxRowsValue > 0) {
    return Math.min(Math.max(maxRowsValue * FILTER_SCAN_MULTIPLIER, FILTER_SCAN_MIN_ROWS), FILTER_SCAN_MAX_ROWS);
  }
  return FILTER_SCAN_DEFAULT_ROWS;
}

function resolveFilterJobScanLimit(projectFetchLimit) {
  return Math.min(Math.max(projectFetchLimit * 2, 1000), FILTER_SCAN_MAX_ROWS * 2);
}

module.exports = {
  FILTER_SCAN_MAX_ROWS,
  resolveFilterScanLimit,
  resolveFilterJobScanLimit,
};
