import { Pool } from 'pg';

async function test() {
  const API = 'http://localhost:8000/api';
  const cookie = 'access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMSIsImlhdCI6MTc5MDE2NDg3OCwiZXhwIjoxNzkwMjUxMjc4fQ.zp3KrdaGkJCH9PEDhuT37igxRnvKP4j2xcir9fvTDmc';
  
  // Test unauthenticated request
  console.log('--- Unauthenticated ---');
  const unauthRes = await fetch(API + '/orders/12/items/14/rating', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating: 3 }),
  });
  console.log(await unauthRes.json());
  
  // Test another user's order (create another user)
  console.log('\n--- Another user ---');
  const regRes = await fetch(API + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test2', email: 'testother@example.com', password: 'password123', confirmPassword: 'password123' }),
    credentials: 'include'
  });
  const regData = await regRes.json();
  const cookie2 = regRes.headers.get('set-cookie');
  console.log('Register:', regData);
  
  const loginRes = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'testother@example.com', password: 'password123' }),
    credentials: 'include'
  });
  const cookieHeader2 = loginRes.headers.get('set-cookie');
  const loginData = await loginRes.json();
  console.log('Login:', loginData);
  
  const otherCookie = Array.isArray(cookieHeader2) ? cookieHeader2[0].split(';')[0] : cookieHeader2.split(';')[0];
  
  // Try to rate user 21's order as user 22
  const otherRes = await fetch(API + '/orders/12/items/14/rating', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': otherCookie },
    body: JSON.stringify({ rating: 2 }),
    credentials: 'include'
  });
  console.log('Rate other user order:', await otherRes.json());
  
  // Test incomplete order
  console.log('\n--- Incomplete order ---');
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'simpleEcommerce',
    user: 'postgres',
    password: '89Sk90!7'
  });
  
  // Create a new order that's still pending/confirmed
  await pool.query("INSERT INTO orders (user_id, total_amount, status) VALUES (21, 25.99, 'confirmed') RETURNING id");
  const newOrder = await pool.query("SELECT id FROM orders WHERE user_id = 21 AND status = 'confirmed' ORDER BY id DESC LIMIT 1");
  const pendingOrderId = newOrder.rows[0].id;
  await pool.query("INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES ($1, 1, 1, 25.99, 25.99)", [pendingOrderId]);
  const newItem = await pool.query("SELECT id FROM order_items WHERE order_id = $1", [pendingOrderId]);
  const pendingItemId = newItem.rows[0].id;
  await pool.end();
  
  // Try to rate incomplete order
  const incompleteRes = await fetch(API + `/orders/${pendingOrderId}/items/${pendingItemId}/rating`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ rating: 3 }),
    credentials: 'include'
  });
  console.log('Rate incomplete order:', await incompleteRes.json());
  
  // Test non-existent order item
  console.log('\n--- Non-existent order item ---');
  const notFoundRes = await fetch(API + '/orders/12/items/9999/rating', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ rating: 3 }),
    credentials: 'include'
  });
  console.log('Rate non-existent:', await notFoundRes.json());
  
  // Test decimal rating
  console.log('\n--- Decimal rating ---');
  const decimalRes = await fetch(API + '/orders/12/items/15/rating', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ rating: 3.5 }),
    credentials: 'include'
  });
  console.log('Rate decimal:', await decimalRes.json());
  
  // Test missing rating
  console.log('\n--- Missing rating ---');
  const missingRes = await fetch(API + '/orders/12/items/15/rating', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({}),
    credentials: 'include'
  });
  console.log('Rate missing:', await missingRes.json());
  
  // Test negative rating
  console.log('\n--- Negative rating ---');
  const negativeRes = await fetch(API + '/orders/12/items/15/rating', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ rating: -1 }),
    credentials: 'include'
  });
  console.log('Rate negative:', await negativeRes.json());
  
  // Test zero rating
  console.log('\n--- Zero rating ---');
  const zeroRes = await fetch(API + '/orders/12/items/15/rating', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ rating: 0 }),
    credentials: 'include'
  });
  console.log('Rate zero:', await zeroRes.json());
  
  // Test string rating
  console.log('\n--- String rating ---');
  const stringRes = await fetch(API + '/orders/12/items/15/rating', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ rating: "5" }),
    credentials: 'include'
  });
  console.log('Rate string:', await stringRes.json());
}
test();