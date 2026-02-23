require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const PAGES_IMMO = [
  { name: "Altitude Vision", id: "267164619819268" },
];

const facebookPostSchema = new mongoose.Schema({
  facebook_id: { type: String, unique: true },
  page_name: String,
  page_id: String,
  message: String,
  image: String,
  permalink: String,
  date_publication: Date,
  date_sync: Date
});

const FacebookPost = mongoose.model('FacebookPost', facebookPostSchema);

async function recupererPosts(pageId) {
  const url = `https://graph.facebook.com/v25.0/${pageId}/posts`;
  const response = await axios.get(url, {
    params: {
      access_token: ACCESS_TOKEN,
      fields: "message,full_picture,created_time,permalink_url",
      limit: 10
    }
  });
  return response.data.data;
}

async function syncFacebook() {
  await connectDB();

  for (const page of PAGES_IMMO) {
    console.log(`Synchronisation de : ${page.name}`);
    const posts = await recupererPosts(page.id);

    for (const post of posts) {
      await FacebookPost.findOneAndUpdate(
        { facebook_id: post.id },
        {
          facebook_id: post.id,
          page_name: page.name,
          page_id: page.id,
          message: post.message || "",
          image: post.full_picture || "",
          permalink: post.permalink_url || "",
          date_publication: new Date(post.created_time),
          date_sync: new Date()
        },
        { upsert: true, new: true }
      );
    }
    console.log(`✅ ${posts.length} posts synchronisés pour ${page.name}`);
  }

  await mongoose.connection.close();
  console.log("✅ Synchronisation terminée !");
}

syncFacebook();