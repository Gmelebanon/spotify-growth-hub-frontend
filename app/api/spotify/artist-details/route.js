import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env.local / Vercel."
    );
  }

  const basicToken = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Spotify token request failed: ${JSON.stringify(data)}`
    );
  }

  return data.access_token;
}

function getBestImage(images = []) {
  if (!Array.isArray(images) || images.length === 0) return null;

  return images[0]?.url || null;
}

function formatDuration(ms = 0) {
  const totalSeconds = Math.floor(Number(ms || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function spotifyFetch(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Spotify request failed: ${JSON.stringify(data)}`);
  }

  return data;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get("artistId");

    if (!artistId) {
      return NextResponse.json(
        {
          message: "Missing artistId.",
        },
        { status: 400 }
      );
    }

    const accessToken = await getSpotifyAccessToken();

    const artistData = await spotifyFetch(
      `https://api.spotify.com/v1/artists/${encodeURIComponent(artistId)}`,
      accessToken
    );

    const albumsData = await spotifyFetch(
      `https://api.spotify.com/v1/artists/${encodeURIComponent(
        artistId
      )}/albums?include_groups=album,single,appears_on,compilation&market=US&limit=50`,
      accessToken
    );

    const uniqueAlbumsMap = new Map();

    for (const album of albumsData.items || []) {
      if (!uniqueAlbumsMap.has(album.id)) {
        uniqueAlbumsMap.set(album.id, album);
      }
    }

    const releases = Array.from(uniqueAlbumsMap.values()).sort((a, b) => {
      const aDate = new Date(a.release_date || "1900-01-01").getTime();
      const bDate = new Date(b.release_date || "1900-01-01").getTime();

      return bDate - aDate;
    });

    const releasesWithTracks = await Promise.all(
      releases.slice(0, 10).map(async (release) => {
        const tracksData = await spotifyFetch(
          `https://api.spotify.com/v1/albums/${encodeURIComponent(
            release.id
          )}/tracks?market=US&limit=50`,
          accessToken
        );

        const tracks = (tracksData.items || []).map((track) => ({
          id: track.id,
          name: track.name,
          trackNumber: track.track_number,
          duration: formatDuration(track.duration_ms),
          explicit: Boolean(track.explicit),
          artists: (track.artists || []).map((artist) => artist.name),
          spotifyUrl:
            track.external_urls?.spotify ||
            `https://open.spotify.com/track/${track.id}`,
        }));

        return {
          id: release.id,
          name: release.name,
          type: release.album_type,
          releaseDate: release.release_date,
          totalTracks: release.total_tracks || tracks.length,
          image: getBestImage(release.images),
          spotifyUrl:
            release.external_urls?.spotify ||
            `https://open.spotify.com/album/${release.id}`,
          tracks,
        };
      })
    );

    const totalTracks = releases.reduce((total, release) => {
      return total + Number(release.total_tracks || 0);
    }, 0);

    const latestRelease = releasesWithTracks[0] || null;

    return NextResponse.json({
      success: true,
      artist: {
        id: artistData.id,
        name: artistData.name,
        image: getBestImage(artistData.images),
        followers: artistData.followers?.total || 0,
        popularity: artistData.popularity || 0,
        genres: artistData.genres || [],
        spotifyUrl:
          artistData.external_urls?.spotify ||
          `https://open.spotify.com/artist/${artistData.id}`,
        totalReleases: releases.length,
        totalTracks,
      },
      releases: releasesWithTracks,
      latestRelease,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error.message || "Could not load artist details.",
      },
      { status: 500 }
    );
  }
}