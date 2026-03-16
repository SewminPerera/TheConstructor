import Navbar     from "../landing/Navbar";
import Hero       from "../landing/Hero";
import StatsStrip from "../landing/StatsStrip";
import HowItWorks from "../landing/HowItWorks";
import Features   from "../landing/Features";
import Footer     from "../landing/Footer";

export default function LandingPage({ onOpenLogin, onGoToDashboard, isLoggedIn }) {
  // If logged in, CTA goes back to dashboard instead of opening login modal
  const handleCTA = isLoggedIn ? onGoToDashboard : onOpenLogin;

  return (
    <>
      <Navbar     onGetStarted={handleCTA} isLoggedIn={isLoggedIn} onGoToDashboard={onGoToDashboard} />
      <Hero       onGetStarted={handleCTA} isLoggedIn={isLoggedIn} />
      <StatsStrip />
      <HowItWorks onGetStarted={handleCTA} />
      <Features />
      <Footer     onGetStarted={handleCTA} />
    </>
  );
}
