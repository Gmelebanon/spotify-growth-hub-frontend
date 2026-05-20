import { spotifyArtistIds, spotifyArtistStats } from "@/lib/spotify-artists";

export const dynamic = "force-dynamic";

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

function parseSpotifyReleaseDate(releaseDate, precision) {
  if (!releaseDate) return null;

  if (precision === "year") {
    return new Date(`${releaseDate}-01-01T00:00:00`);
  }

  if (precision === "month") {
    return new Date(`${releaseDate}-01T00:00:00`);
  }

  return new Date(`${releaseDate}T00:00:00`);
}

function getDaysAgo(date) {
  if (!date) return null;

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const releaseDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const difference = startOfToday.getTime() - releaseDay.getTime();

  return Math.floor(difference / (1000 * 60 * 60 * 24));
}

function formatDuration(milliseconds) {
  if (!milliseconds) return "0:00";

  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

async function fetchArtistAlbums(artistId, accessToken) {
  const response = await fetch(
    `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&market=US&limit=20`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Spotify artist albums request failed: ${text}`);
  }

  const data = JSON.parse(text);
  return data.items || [];
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

export async function GET() {
  try {
    const accessToken = await getSpotifyAccessToken();

    if (!spotifyArtistIds || spotifyArtistIds.length === 0) {
      throw new Error("No Spotify artist IDs found.");
    }

    const ids = spotifyArtistIds.join(",");

    const artistsResponse = await fetch(
      `https://api.spotify.com/v1/artists?ids=${ids}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    const artistsText = await artistsResponse.text();

    if (!artistsResponse.ok) {
      throw new Error(`Spotify artists request failed: ${artistsText}`);
    }

    const artistsData = JSON.parse(artistsText);

    const artists = artistsData.artists
      .filter(Boolean)
      .map((artist) => {
        const manualStats = spotifyArtistStats[artist.id] || {
          streams: 0,
          growthPercent: 0,
        };

        return {
          id: artist.id,
          name: artist.name,
          image:
            artist.images?.[0]?.url ||
            artist.images?.[1]?.url ||
            artist.images?.[2]?.url ||
            null,
          followers: artist.followers?.total || 0,
          popularity: artist.popularity || 0,
          genres: artist.genres || [],
          spotifyUrl: artist.external_urls?.spotify,
          streams: manualStats.streams || 0,
          growthPercent: manualStats.growthPercent || 0,
        };
      });

    const artistNameById = new Map(
      artists.map((artist) => [artist.id, artist.name])
    );

    const albumsByArtist = await Promise.all(
      spotifyArtistIds.map(async (artistId) => {
        const albums = await fetchArtistAlbums(artistId, accessToken);

        return albums.map((album) => {
          const parsedDate = parseSpotifyReleaseDate(
            album.release_date,
            album.release_date_precision
          );

          const daysAgo = getDaysAgo(parsedDate);

          return {
            id: album.id,
            artistId,
            artistName: artistNameById.get(artistId) || "Unknown Artist",
            name: album.name,
            type: album.album_type,
            totalTracks: album.total_tracks,
            image:
              album.images?.[0]?.url ||
              album.images?.[1]?.url ||
              album.images?.[2]?.url ||
              null,
            releaseDate: album.release_date,
            releaseDatePrecision: album.release_date_precision,
            daysAgo,
            isWithinSevenDays:
              typeof daysAgo === "number" && daysAgo >= 0 && daysAgo <= 7,
            isNewRelease:
              typeof daysAgo === "number" && daysAgo >= 0 && daysAgo <= 2,
            spotifyUrl: album.external_urls?.spotify,
            tracks: [],
          };
        });
      })
    );

    const uniqueReleasesMap = new Map();

    albumsByArtist.flat().forEach((release) => {
      if (!release.isWithinSevenDays) return;

      const key = `${release.id}-${release.artistId}`;

      if (!uniqueReleasesMap.has(key)) {
        uniqueReleasesMap.set(key, release);
      }
    });

    const newReleasesWithoutTracks = Array.from(
      uniqueReleasesMap.values()
    ).sort((a, b) => {
      const aDays = typeof a.daysAgo === "number" ? a.daysAgo : 999;
      const bDays = typeof b.daysAgo === "number" ? b.daysAgo : 999;

      return aDays - bDays;
    });

    const newReleases = await Promise.all(
      newReleasesWithoutTracks.map(async (release) => ({
        ...release,
        tracks: await fetchAlbumTracks(release.id, accessToken),
      }))
    );

    return Response.json({
      success: true,
      artists,
      newReleases,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: "Could not load Spotify artists.",
        message: error.message,
      },
      { status: 500 }
    );
  }
}