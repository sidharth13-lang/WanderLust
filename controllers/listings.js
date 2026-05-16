const Listing = require("../models/listing");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");

const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

/* =====================================================
   INDEX (with search support)
===================================================== */
module.exports.index = async (req, res) => {
  const { search } = req.query;
  let allListings;

  if (search) {
    allListings = await Listing.find({
      $or: [
        { title: new RegExp(search, "i") },
        { location: new RegExp(search, "i") },
      ],
    });
  } else {
    allListings = await Listing.find({});
  }

  res.render("listings/index.ejs", { allListings, search });
};

/* =====================================================
   NEW FORM
===================================================== */
module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
};

/* =====================================================
   SHOW LISTING
===================================================== */
module.exports.showListings = async (req, res) => {
  const { id } = req.params;

  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: { path: "author" },
    })
    .populate("owner");

  if (!listing) {
    req.flash("error", "Listing you requested for does not exist!");
    return res.redirect("/listings");
  }

  res.render("listings/show", {
    listing,
    mapToken: process.env.MAP_TOKEN,
  });
};

/* =====================================================
   CREATE LISTING  (FIXED)
===================================================== */
module.exports.createListing = async (req, res) => {
  try {
    // 🔹 Validate login (prevents req.user undefined crash)
    if (!req.user) {
      req.flash("error", "You must be logged in to create a listing.");
      return res.redirect("/login");
    }

    // 🔹 Geocode location
    const response = await geocodingClient
      .forwardGeocode({
        query: req.body.listing.location,
        limit: 1,
      })
      .send();

    const geometry = response.body.features[0]?.geometry;

    if (!geometry) {
      req.flash("error", "Invalid location. Please enter a valid address.");
      return res.redirect("/listings/new");
    }

    // 🔹 Ensure image uploaded
    if (!req.file) {
      req.flash("error", "Image upload failed. Please upload an image.");
      return res.redirect("/listings/new");
    }

    const url = req.file.path;
    const filename = req.file.filename;

    // 🔹 Create listing
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    newListing.image = { url, filename };
    newListing.geometry = geometry;

    await newListing.save();

    req.flash("success", "New Listing created!");
    res.redirect("/listings");
  } catch (err) {
    console.error("❌ Error creating listing:", err);
    req.flash("error", "Something went wrong while creating the listing.");
    res.redirect("/listings/new");
  }
};

/* =====================================================
   EDIT FORM
===================================================== */
module.exports.renderEditForm = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "Listing you requested for does not exist!");
    return res.redirect("/listings");
  }

  let originalImageUrl = listing.image.url;
  originalImageUrl = originalImageUrl.replace("/upload", "/upload/h_300,w_250");

  res.render("listings/edit.ejs", { listing, originalImageUrl });
};

/* =====================================================
   UPDATE LISTING
===================================================== */
module.exports.updateListing = async (req, res) => {
  const { id } = req.params;

  let listing = await Listing.findByIdAndUpdate(id, {
    ...req.body.listing,
  });

  if (req.file) {
    const url = req.file.path;
    const filename = req.file.filename;
    listing.image = { url, filename };
    await listing.save();
  }

  req.flash("success", "Listing Updated!");
  res.redirect(`/listings/${id}`);
};

/* =====================================================
   DELETE LISTING
===================================================== */
module.exports.destroyListing = async (req, res) => {
  const { id } = req.params;

  await Listing.findByIdAndDelete(id);

  req.flash("success", "Listing Deleted!");
  res.redirect("/listings");
};