const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    discountType: {
        type: String,
        enum: ["percentage", "flat"],
        required: true
    },
    discountValue: {
        type: Number,
        required: true
    },
    sellingPrice: {
        type: Number,
        required: true
    }
}, { _id: false });

const quantitySchema = new mongoose.Schema({
    quantity: {
        type: String,
        required: true
    },
    packages: {
        type: [packageSchema],
        default: []
    }
}, { _id: false });

const metadataSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    order: {
        type: Number,
        default: 0
    }
}, { _id: false });

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            default: null
        },
        images: {
            type: [mongoose.Schema.Types.Mixed],
            default: []
        },
        productVideo: {
            type: String,
            default: null
        },
        categories: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: "Categories",
            default: []
        },
        quantityDetails: {
            type: [quantitySchema],
            default: []
        },
        metadata: {
            type: [metadataSchema],
            default: []
        },
        order: {
            type: Number,
            default: 100
        },
        isPublished: {
            type: Boolean,
            default: false
        },
        isPopular: {
            type: Boolean,
            default: false
        },
        isFeatured: {
            type: Boolean,
            default: false
        },
        countFavorite: {
            type: Number,
            default: 0
        },
        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

const Products = mongoose.model("Products", productSchema);
module.exports = { Products };