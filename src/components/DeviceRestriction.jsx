import React from "react";
import { Laptop, Smartphone, ShieldAlert, Monitor, AlertTriangle } from "lucide-react";

export default function DeviceRestriction({ deviceType }) {
  return (
    <div className="mobile-restriction-screen">
      <div className="mobile-restriction-card">
        <div className="restriction-icon-wrap">
          <Smartphone size={40} className="phone-icon-blocked" />
          <div className="block-slash">✕</div>
        </div>

        <div className="restriction-badge">
          <ShieldAlert size={16} />
          <span>LAPTOP / DESKTOP REQUIRED</span>
        </div>

        <h2>Mobile & Android Devices Not Allowed</h2>

        <p className="restriction-msg">
          This event requires strict full-screen anti-cheat monitoring and 
          <strong> cannot be accessed from an Android device or mobile phone</strong>.
        </p>

        <div className="device-guidelines-box">
          <div className="guideline-item allowed">
            <Laptop size={22} className="text-neon-cyan" />
            <div>
              <div className="device-status-title">Permitted Device</div>
              <div className="device-status-desc">Laptops & Desktop Computers (Chrome, Edge, Firefox)</div>
            </div>
          </div>

          <div className="guideline-item blocked">
            <Smartphone size={22} className="text-neon-red" />
            <div>
              <div className="device-status-title">Strictly Blocked</div>
              <div className="device-status-desc">Android Phones, iPhones, Tablets, iPads</div>
            </div>
          </div>
        </div>

        <div className="restriction-footer-note">
          <AlertTriangle size={16} className="text-gold" />
          <span>
            Please open this URL <strong>(http://{window.location.hostname}:5173)</strong> on your laptop to participate.
          </span>
        </div>
      </div>
    </div>
  );
}
