import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer-section">
      <div className="footer-top">

        <div className="footer-brand">
          <h3 className="footer-brand-name">TheConstructor<span> AI</span></h3>
          <p className="footer-tagline">
            AI-powered foundation cost estimation built for Sri Lankan construction professionals.
          </p>
          <div className="footer-socials">
            <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" className="footer-social-btn" aria-label="Instagram">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
              Instagram
            </a>
            <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer" className="footer-social-btn" aria-label="Facebook">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
              </svg>
              Facebook
            </a>
          </div>
        </div>

        <div className="footer-col">
          <h4>Product</h4>
          <ul>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#features">Features</a></li>
            <li><a href="#features">DXF Precision</a></li>
            <li><a href="#features">AI Vision Mode</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Technology</h4>
          <ul>
            <li>YOLO v8 Detection</li>
            <li>CIDA 1:2:4 Mix Ratios</li>
            <li>DXF Layer Parsing</li>
            <li>LKR Market Pricing</li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Contact</h4>
          <ul>
            <li>📍 Kandy, Sri Lanka</li>
            <li><a href="mailto:contact@theconstructor.ai">contact@theconstructor.ai</a></li>
          </ul>
        </div>

      </div>

      <div className="footer-bottom">
        <span>© 2025 TheConstructor AI · All rights reserved</span>
      </div>
    </footer>
  );
}
