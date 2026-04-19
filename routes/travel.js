const router = require('express').Router();
const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.userId = jwt.verify(token, process.env.JWT_SECRET).id;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

const DUFFEL_BASE = 'https://api.duffel.com';
const DUFFEL_HEADERS = {
  'Authorization': `Bearer ${process.env.DUFFEL_API_KEY}`,
  'Content-Type': 'application/json',
  'Duffel-Version': 'v2',
  'Accept': 'application/json'
};

async function getAirportCode(location) {
  if (/^[A-Z]{3}$/.test(location.toUpperCase())) {
    return location.toUpperCase();
  }
  try {
    const response = await fetch(`${DUFFEL_BASE}/air/airport_suggestions?query=${encodeURIComponent(location)}`, {
      headers: DUFFEL_HEADERS
    });
    const data = await response.json();
    if (data.data && data.data.length > 0) {
      return data.data[0].iata_code;
    }
    return 'JFK';
  } catch (err) {
    console.error('Airport lookup failed:', err);
    return 'JFK';
  }
}

function getMockFlights(origin, destination, date) {
  const slots = [
    { airline: 'United Airlines',   num: 'UA456', dep: '05:30', arr: '10:45', dur: 'PT5H15M', stops: 1, price: 189.99 },
    { airline: 'Delta Air Lines',   num: 'DL123', dep: '07:00', arr: '10:30', dur: 'PT3H30M', stops: 0, price: 299.99 },
    { airline: 'Southwest',         num: 'WN234', dep: '08:45', arr: '14:30', dur: 'PT5H45M', stops: 1, price: 159.99 },
    { airline: 'American Airlines', num: 'AA789', dep: '10:15', arr: '14:15', dur: 'PT4H00M', stops: 0, price: 349.99 },
    { airline: 'JetBlue',           num: 'B6567', dep: '12:00', arr: '15:30', dur: 'PT3H30M', stops: 0, price: 279.99 },
    { airline: 'Alaska Airlines',   num: 'AS890', dep: '14:30', arr: '19:45', dur: 'PT5H15M', stops: 1, price: 219.99 },
    { airline: 'Delta Air Lines',   num: 'DL321', dep: '17:00', arr: '20:30', dur: 'PT3H30M', stops: 0, price: 329.99 },
    { airline: 'United Airlines',   num: 'UA789', dep: '19:45', arr: '01:00', dur: 'PT5H15M', stops: 1, price: 174.99 },
  ];
  return slots.map((o, i) => ({
    id: `mock_${Date.now()}_${i + 1}`,
    airline: o.airline,
    airlineLogo: null,
    price: o.price,
    currency: 'USD',
    duration: o.dur,
    stops: o.stops,
    departsAt: `${date}T${o.dep}:00Z`,
    arrivesAt: `${date}T${o.arr}:00Z`,
    flightNumber: o.num
  }));
}

function getMockHotels(city, checkIn, checkOut) {
  return [
    {
      id: `mock_hotel_${Date.now()}_1`,
      name: `${city} Grand Hotel`,
      rating: 4.5,
      photo: null,
      address: `Downtown ${city}`,
      price: 189,
      currency: 'USD',
      checkIn,
      checkOut
    },
    {
      id: `mock_hotel_${Date.now()}_2`,
      name: `${city} Business Suites`,
      rating: 4.2,
      photo: null,
      address: `Business District, ${city}`,
      price: 245,
      currency: 'USD',
      checkIn,
      checkOut
    },
    {
      id: `mock_hotel_${Date.now()}_3`,
      name: `${city} Airport Inn`,
      rating: 3.8,
      photo: null,
      address: `Near Airport, ${city}`,
      price: 129,
      currency: 'USD',
      checkIn,
      checkOut
    }
  ];
}

router.post('/flights', auth, async (req, res) => {
  const { origin, destination, date, passengers = 1 } = req.body;
  console.log('Flight search request:', { origin, destination, date });

  if (!origin || !destination || !date) {
    return res.status(400).json({ error: 'origin, destination, and date are required' });
  }

  try {
    const originCode = await getAirportCode(origin);
    const destCode = await getAirportCode(destination);

    console.log(`Searching flights: ${originCode} → ${destCode} on ${date}`);

    const response = await fetch(`${DUFFEL_BASE}/air/offer_requests`, {
      method: 'POST',
      headers: DUFFEL_HEADERS,
      body: JSON.stringify({
        data: {
          slices: [{
            origin: originCode,
            destination: destCode,
            departure_date: date
          }],
          passengers: Array(passengers).fill({ type: 'adult' }),
          cabin_class: 'economy'
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Duffel API error:', data);
      return res.json({ offers: getMockFlights(origin, destination, date) });
    }

    const offers = (data.data?.offers || [])
      .sort((a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount))
      .slice(0, 5)
      .map(o => ({
        id: o.id,
        airline: o.owner?.name,
        airlineLogo: o.owner?.logo_symbol_url,
        price: parseFloat(o.total_amount),
        currency: o.total_currency,
        duration: o.slices?.[0]?.duration,
        stops: (o.slices?.[0]?.segments?.length || 1) - 1,
        departsAt: o.slices?.[0]?.segments?.[0]?.departing_at,
        arrivesAt: o.slices?.[0]?.segments?.slice(-1)[0]?.arriving_at,
        flightNumber: o.slices?.[0]?.segments?.[0]?.operating_carrier_flight_number
      }));

    res.json({ offers: offers.length ? offers : getMockFlights(origin, destination, date) });
  } catch (err) {
    console.error('Flight search error:', err);
    res.json({ offers: getMockFlights(origin, destination, date) });
  }
});

router.post('/hotels', auth, async (req, res) => {
  const { cityCode, checkIn, checkOut, guests = 1 } = req.body;
  if (!cityCode || !checkIn || !checkOut) {
    return res.status(400).json({ error: 'cityCode, checkIn, and checkOut are required' });
  }

  try {
    const searchBody = {
      data: {
        location: {
          city_name: cityCode
        },
        check_in_date: checkIn,
        check_out_date: checkOut,
        rooms: [{
          adults: guests
        }]
      }
    };

    console.log('Searching hotels with:', searchBody);

    const searchRes = await fetch(`${DUFFEL_BASE}/stays/search`, {
      method: 'POST',
      headers: DUFFEL_HEADERS,
      body: JSON.stringify(searchBody)
    });

    const rawText = await searchRes.text();
    let searchData;
    try {
      searchData = JSON.parse(rawText);
    } catch {
      console.error('Duffel hotel response (not JSON):', rawText);
      return res.json({ results: getMockHotels(cityCode, checkIn, checkOut) });
    }

    if (!searchRes.ok) {
      console.error('Duffel hotel error:', searchData);
      return res.json({ results: getMockHotels(cityCode, checkIn, checkOut) });
    }

    const results = (searchData.data?.results || [])
      .slice(0, 5)
      .map(r => ({
        id: r.id,
        name: r.accommodation?.name || 'Hotel',
        rating: r.accommodation?.rating || 4,
        photo: r.accommodation?.photos?.[0]?.url,
        address: r.accommodation?.location?.address?.line_one,
        price: parseFloat(r.total_amount?.amount || r.cheapest_rate_total_amount || 150),
        currency: r.total_amount?.currency || r.cheapest_rate_currency || 'USD',
        checkIn,
        checkOut
      }));

    res.json({ results: results.length ? results : getMockHotels(cityCode, checkIn, checkOut) });
  } catch (err) {
    console.error('Hotel search error:', err);
    res.json({ results: getMockHotels(cityCode, checkIn, checkOut) });
  }
});

module.exports = router;