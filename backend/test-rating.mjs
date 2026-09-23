import { Pool } from 'pg';

async function test() {
  // Directly update order status to completed in DB
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'simpleEcommerce',
    user: 'postgres',
    password: '89Sk90!7'
  });
  
  await pool.query("UPDATE orders SET status = 'completed' WHERE id = 12");
  console.log('Order 12 marked as completed');
  await pool.end();
  
  // Now test the rating API
  const API = 'http://localhost:8000/api';
  const cookie = 'access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMSIsImlhdCI6MTc5MDE2NDg3OCwiZXhwIjoxNzkwMjUxMjc4fQ.zp3KrdaGkJCH9PEDhuT37igxRnvKP4j2xcir9fvTDmc';
  
  // Test GET /api/orders/12 - should include rating info
  const orderRes = await fetch(API + '/orders/12', {
    headers: { 'Cookie': cookie },
    credentials: 'include'
  });
  const orderData = await orderRes.json();
  console.log('GET Order 12:', JSON.stringify(orderData, null, 2));
  
  // Test POST rating for item 14 (product 1)
  const rateRes = await fetch(API + '/orders/12/items/14/rating', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ rating: 5 }),
    credentials: 'include'
  });
  const rateData = await rateRes.json();
  console.log('POST Rating 5:', JSON.stringify(rateData, null, 2));
  
  // Test duplicate rating (should fail)
  const rateRes2 = await fetch(API + '/orders/12/items/14/rating', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ rating: 3 }),
    credentials: 'include'
  });
  const rateData2 = await rateRes2.json();
  console.log('POST Duplicate Rating:', JSON.stringify(rateData2, null, 2));
  
  // Test invalid rating (should fail)
  const rateRes3 = await fetch(API + '/orders/12/items/15/rating', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ rating: 6 }),
    credentials: 'include'
  });
  const rateData3 = await rateRes3.json();
  console.log('POST Invalid Rating (6):', JSON.stringify(rateData3, null, 2));
  
  // Test valid rating for second item
  const rateRes4 = await fetch(API + '/orders/12/items/15/rating', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ rating: 4 }),
    credentials: 'include'
  });
  const rateData4 = await rateRes4.json();
  console.log('POST Rating 4:', JSON.stringify(rateData4, null, 2));
  
  // Check product rating summary
  const productRes = await fetch(API + '/products/1');
  const productData = await productRes.json();
  console.log('Product 1 rating:', JSON.stringify(productData.data?.rating, null, 2));
  
  const productRes2 = await fetch(API + '/products/2');
  const productData2 = await productRes2.json();
  console.log('Product 2 rating:', JSON.stringify(productData2.data?.rating, null, 2));
}
test();