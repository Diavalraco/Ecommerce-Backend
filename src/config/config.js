const Joi = require('joi');
const path = require('path');
const dotnev = require('dotenv');

dotnev.config({path: path.join(__dirname, '../../.env')});

const parseKey = key => {
  if (!key) return key;
  let cleanKey = key.replace(/^["']|["']$/g, '');
  cleanKey = cleanKey.replace(/\\n/g, '\n');
  if (!cleanKey.includes('-----BEGIN PRIVATE KEY-----')) {
    console.warn('Private key does not appear to be properly formatted');
  }

  return cleanKey;
};

// schema of env files for validation
const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string()
      .valid('test', 'development', 'production')
      .required(),
    PORT: Joi.number().default(8082),
    MONGODB_URL: Joi.string().required(),
    // TWILIO_PHONE: Joi.string().required(),
    // TWILIO_SID: Joi.string().required(),
    // TWILIO_AUTH_TOKEN: Joi.string().required(),
    AWS_S3_SECRET_ACCESS_KEY: Joi.string().required(),
    AWS_S3_REGION: Joi.string().required(),
    AWS_S3_ACCESS_KEY_ID: Joi.string().required(),
    AWS_S3_BUCKET: Joi.string().required(),
    FIREBASE_API_KEY: Joi.string().required(),
    FIREBASE_TYPE: Joi.string().required(),
    FIREBASE_PROJECT_ID: Joi.string().required(),
    FIREBASE_PRIVATE_KEY_ID: Joi.string().required(),
    FIREBASE_PRIVATE_KEY: Joi.string().required(),
    FIREBASE_CLIENT_EMAIL: Joi.string().required(),
    FIREBASE_CLIENT_ID: Joi.string().required(),
    FIREBASE_AUTH_URI: Joi.string().required(),
    FIREBASE_TOKEN_URI: Joi.string().required(),
    FIREBASE_AUTH_PROVIDER_X509_CERT_URL: Joi.string().required(),
    FIREBASE_CLIENT_X509_CERT_URL: Joi.string().required(),
    FIREBASE_UNIVERSE_DOMAIN: Joi.string().required(),
  })
  .unknown();

// validating the process.env object that contains all the env variables
const {value: envVars, error} = envVarsSchema.prefs({errors: {label: 'key'}}).validate(process.env);

// throw error if the validation fails or results into false
if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  twilio: {
    sid: envVars.TWILIO_SID,
    phone: envVars.TWILIO_PHONE,
    authToken: envVars.TWILIO_AUTH_TOKEN,
  },
  aws: {
    s3: {
      name: envVars.AWS_S3_BUCKET,
      region: envVars.AWS_S3_REGION,
      accessKeyId: envVars.AWS_S3_ACCESS_KEY_ID,
      secretAccessKey: envVars.AWS_S3_SECRET_ACCESS_KEY,
    },
  },
  mongoose: {
    // exception added for TDD purpose
    url: envVars.MONGODB_URL + (envVars.NODE_ENV === 'test' ? '-test' : ''),
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  firebase: {
    type: envVars.FIREBASE_TYPE,
    project_id: envVars.FIREBASE_PROJECT_ID,
    private_key_id: envVars.FIREBASE_PRIVATE_KEY_ID,
    private_key: parseKey(envVars.FIREBASE_PRIVATE_KEY),
    client_email: envVars.FIREBASE_CLIENT_EMAIL,
    client_id: envVars.FIREBASE_CLIENT_ID,
    auth_uri: envVars.FIREBASE_AUTH_URI,
    token_uri: envVars.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: envVars.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: envVars.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: envVars.FIREBASE_UNIVERSE_DOMAIN,
    apiKey: envVars.FIREBASE_API_KEY,
  },
  cloudflare: {
    r2: {
      bucketName: envVars.R2_BUCKET_NAME,
      accountId: envVars.R2_ACCOUNT_ID,
      endpoint: envVars.R2_ENDPOINT,
      accessKeyId: envVars.R2_ACCESS_KEY_ID,
      secretAccessKey: envVars.R2_SECRET_ACCESS_KEY,
      publicBaseUrl: 'https://7ec6c3b59b4801f2994d518529dc4078.r2.cloudflarestorage.com', 
    },
  },

  //  twilio: {
  //   accountSid: envVars.TWILIO_ACCOUNT_SID,
  //   authToken: envVars.TWILIO_AUTH_TOKEN,
  //  messagingServiceSid: envVars.TWILIO_MESSAGING_SERVICE_SID ,
  //  fromNumber: '+17753069750',
  // },
};
