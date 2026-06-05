// Next.js API Route for authentication proxy
// Since the backend doesn't have auth endpoints, we use a simple local authentication approach

export const config = {
  api: {
    bodyParser: true,
  },
};

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  username: string;
}

// Default credentials (in production, use environment variables)
const DEFAULT_USERNAME = process.env.NEXT_PUBLIC_AUTH_USERNAME || 'admin';
const DEFAULT_PASSWORD = process.env.NEXT_PUBLIC_AUTH_PASSWORD || 'admin123';

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Method not allowed' });
  }

  const body: LoginRequest = req.body;

  // Simple authentication (for development/demo purposes)
  if (body.username === DEFAULT_USERNAME && body.password === DEFAULT_PASSWORD) {
    const token = Buffer.from(`${body.username}:${Date.now()}`).toString('base64');
    
    // Set cookie as well
    res.status(200).json({
      access_token: token,
      token_type: 'bearer',
      username: body.username,
    } as LoginResponse);
  } else {
    res.status(401).json({ detail: 'Invalid credentials' });
  }
}