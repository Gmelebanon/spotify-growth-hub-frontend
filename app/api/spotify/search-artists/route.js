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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return Response.json({
        success: true,
        artists: [],
      });
    }

    const accessToken = await getSpotifyAccessToken();

    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        query
      )}&type=artist&market=US&limit=8`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Spotify search request failed: ${text}`);
    }

    const data = JSON.parse(text);

    const artists = (data.artists?.items || []).map((artist) => ({
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
    }));

    return Response.json({
      success: true,
      artists,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: "Could not search Spotify artists.",
        message: error.message,
      },
      { status: 500 }
    );
  }
}