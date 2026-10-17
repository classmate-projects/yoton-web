import SplashScreen from "./SplashScreen";

// Runs before first paint: if the splash was already shown in this tab
// (e.g. the user refreshed), hide it immediately so it never flashes.
// Keep the key in sync with SPLASH_STORAGE_KEY in SplashScreen.tsx.
const splashGateScript = `try{if(sessionStorage.getItem("yoton_splash"))document.documentElement.classList.add("splash-seen")}catch(e){}`;

export function SplashScreenGate() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: splashGateScript }} />
      <style>{`html.splash-seen #yoton-splash{display:none!important}`}</style>
    </>
  );
}

// Rendered on the server (no ssr:false) so the splash is in the very first
// HTML paint, before the page underneath can flash.
export default function SplashScreenLoader() {
  return <SplashScreen />;
}
