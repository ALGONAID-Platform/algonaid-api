async function main() {
  const url = 'http://localhost:3000/api/v1';
  try {
    console.log('Logging in as student...');
    const loginRes = await fetch(`${url}/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'teststudent@example.com',
        password: 'Password123!'
      })
    });
    
    const loginData = await loginRes.json() as any;
    if (!loginRes.ok) {
      console.error('Login failed:', loginData);
      return;
    }
    const token = loginData.access_token;
    console.log('Login successful. Token:', token);

    console.log('Requesting lessons for module 1...');
    const lessonsRes = await fetch(`${url}/lessons/module/1`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    const lessonsData = await lessonsRes.json();
    console.log('Lessons response status:', lessonsRes.status);
    console.log('Lessons response data:', lessonsData);
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

main();
