export const dynamic = "force-dynamic";

function cleanSpotifyArtistId(value) {
  if (!value) return "";

  const decodedValue = decodeURIComponent(String(value)).trim();

  if (decodedValue.includes("open.spotify.com/artist/")) {
    return decodedValue
      .split("open.spotify.com/artist/")[1]
      .split("?")[0]
      .split("/")[0];
  }

  if (decodedValue.includes("spotify:artist:")) {
    return decodedValue
      .split("spotify:artist:")[1]
      .split("?")[0]
      .split("/")[0];
  }

  return decodedValue.split("?")[0].split("/")[0];
}

function isValidSpotifyArtistId(artistId) {
  return /^[A-Za-z0-9]{22}$/.test(artistId);
}

async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env.local"
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Spotify token request failed: ${text}`);
  }

  const data = JSON.parse(text);
  return data.access_token;
}

function formatDuration(milliseconds) {
  if (!milliseconds) return "0:00";

  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

async function fetchAlbumTracks(albumId, accessToken) {
  const response = await fetch(
    `https://api.spotify.com/v1/albums/${albumId}/tracks?market=US&limit=50`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Spotify album tracks request failed: ${text}`);
  }

  const data = JSON.parse(text);

  return (data.items || []).map((track) => ({
    id: track.id,
    name: track.name,
    trackNumber: track.track_number,
    durationMs: track.duration_ms,
    duration: formatDuration(track.duration_ms),
    explicit: track.explicit,
    previewUrl: track.preview_url,
    spotifyUrl: track.external_urls?.spotify,
    artists: track.artists?.map((artist) => artist.name) || [],
  }));
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const artistId = cleanSpotifyArtistId(searchParams.get("artistId"));

    if (!isValidSpotifyArtistId(artistId)) {
      return Response.json(
        {
          success: false,
          error: "Invalid Spotify artist ID.",
          message: `Received invalid artist ID: "${artistId}". The ID must be 22 letters/numbers.`,
        },
        { status: 400 }
      );
    }

    const accessToken = await getSpotifyAccessToken();

    const artistResponse = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    const artistText = await artistResponse.text();

    if (!artistResponse.ok) {
      throw new Error(`Spotify artist request failed: ${artistText}`);
    }

    const artistData = JSON.parse(artistText);

    const albumsResponse = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&market=US&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    const albumsText = await albumsResponse.text();

    if (!albumsResponse.ok) {
      throw new Error(`Spotify albums request failed: ${albumsText}`);
    }

    const albumsData = JSON.parse(albumsText);

    const uniqueAlbums = [];
    const albumKeys = new Set();

    for (const album of albumsData.items || []) {
      const key = `${album.name}-${album.release_date}`;

      if (!albumKeys.has(key)) {
        albumKeys.add(key);
        uniqueAlbums.push(album);
      }
    }

    const releases = await Promise.all(
      uniqueAlbums.map(async (album) => ({
        id: album.id,
        name: album.name,
        type: album.album_type,
        totalTracks: album.total_tracks,
        image:
          album.images?.[0]?.url ||
          album.images?.[1]?.url ||
          album.images?.[2]?.url ||
          null,
        releaseDate: album.release_date,
        spotifyUrl: album.external_urls?.spotify,
        tracks: await fetchAlbumTracks(album.id, accessToken),
      }))
    );

    const totalTracks = releases.reduce(
      (total, release) => total + (release.totalTracks || 0),
      0
    );

    const artist = {
      id: artistData.id,
      name: artistData.name,
      image:
        artistData.images?.[0]?.url ||
        artistData.images?.[1]?.url ||
        artistData.images?.[2]?.url ||
        null,
      followers: artistData.followers?.total || 0,
      popularity: artistData.popularity || 0,
      genres: artistData.genres || [],
      spotifyUrl: artistData.external_urls?.spotify,
      totalReleases: releases.length,
      totalTracks,
      latestRelease: releases[0] || null,
    };

    return Response.json({
      success: true,
      artist,
      releases,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: "Could not load Spotify artist details.",
        message: error.message,
      },
      { status: 500 }
    );
  }
}