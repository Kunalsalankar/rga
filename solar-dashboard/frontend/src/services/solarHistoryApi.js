import axios from 'axios';

export const fetchSolarHistory = async ({ assetId, timeoutMs = 10000 } = {}) => {
  if (!assetId) throw new Error('assetId is required');

  try {
    const res = await axios.get('/api/solar-history', {
      params: { assetId },
      timeout: timeoutMs
    });

    const data = res?.data;
    if (!Array.isArray(data)) {
      throw new Error('Unexpected API response: expected an array');
    }

    return data;
  } catch (err) {
    const status = err?.response?.status;
    const msg = err?.response?.data?.message || err?.message || 'Failed to fetch solar history';

    if (status) {
      throw new Error(`Solar history request failed (${status}): ${msg}`);
    }

    throw new Error(msg);
  }
};
