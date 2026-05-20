export const spotifyArtistIds = [
  "060FDwjb9cOepAZbtEBs94",
  "0qufKoRNYHeD4kUblPnMho",
  "0ryfvW3f9S8lD6KYjOzXbO",
  "0VFTixxlGW2YhYi91EDm3B",
  "0wdSs51oLo1nuB5bolXmni",
  "0z7SDFl1aKcqCy6ccos5Ou",
  "1nvbByjsaipbB43fbsNNUY",
  "2DEHy0f1vNhVjl4l3AzDLW",
  "3sD8jMOfmzGh6nQ43Pwf5N",
  "3yQ59FdOMU9EqgR2FgYGyJ",
  "4vfS5Q2OdEybt6Ua1E2Exg",
  "5LZ8B3PKEOoYW21wcBntLI",
  "5MrgbTcDBWQ3i6oWgMUe7k",
  "5w3XLb0Zwob3zcPsMy6L9L",
  "67KzkqGwCMmFTb9OVsxg0P",
];

export const spotifyArtistStats = {
  "060FDwjb9cOepAZbtEBs94": {
    streams: 0,
    growthPercent: 0,
  },
  "0qufKoRNYHeD4kUblPnMho": {
    streams: 0,
    growthPercent: 0,
  },
  "0ryfvW3f9S8lD6KYjOzXbO": {
    streams: 0,
    growthPercent: 0,
  },
  "0VFTixxlGW2YhYi91EDm3B": {
    streams: 0,
    growthPercent: 0,
  },
  "0wdSs51oLo1nuB5bolXmni": {
    streams: 0,
    growthPercent: 0,
  },
  "0z7SDFl1aKcqCy6ccos5Ou": {
    streams: 0,
    growthPercent: 0,
  },
  "1nvbByjsaipbB43fbsNNUY": {
    streams: 0,
    growthPercent: 0,
  },
  "2DEHy0f1vNhVjl4l3AzDLW": {
    streams: 0,
    growthPercent: 0,
  },
  "3sD8jMOfmzGh6nQ43Pwf5N": {
    streams: 0,
    growthPercent: 0,
  },
  "3yQ59FdOMU9EqgR2FgYGyJ": {
    streams: 0,
    growthPercent: 0,
  },
  "4vfS5Q2OdEybt6Ua1E2Exg": {
    streams: 0,
    growthPercent: 0,
  },
  "5LZ8B3PKEOoYW21wcBntLI": {
    streams: 0,
    growthPercent: 0,
  },
  "5MrgbTcDBWQ3i6oWgMUe7k": {
    streams: 0,
    growthPercent: 0,
  },
  "5w3XLb0Zwob3zcPsMy6L9L": {
    streams: 0,
    growthPercent: 0,
  },
  "67KzkqGwCMmFTb9OVsxg0P": {
    streams: 0,
    growthPercent: 0,
  },
};

export const spotifyArtists = spotifyArtistIds.map((id) => ({
  id,
  spotifyUrl: `https://open.spotify.com/artist/${id}`,
  streams: spotifyArtistStats[id]?.streams || 0,
  growthPercent: spotifyArtistStats[id]?.growthPercent || 0,
}));