import Head from 'next/head';
import Script from 'next/script';
import '../styles/globals.css';

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>PaylinkApi — FAST • SECURE • EASY</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#f8fafc" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="icon" type="image/png" href="/logo.png" />
      </Head>
      <Script src="/three.r134.min.js" strategy="beforeInteractive" />
      <Script src="/vanta.globe.min.js" strategy="beforeInteractive" />
      <Component {...pageProps} />
    </>
  );
}
