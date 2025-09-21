'use client';

import React from 'react';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import './HomePage.css';

// Dummy message data
const dummyMessages = [
  {
    id: 1,
    time: '09:15:42',
    date: 'Dec 21',
    message: 'Welcome to Spacewars!'
  },
  {
    id: 2,
    time: '14:30:18',
    date: 'Dec 20',
    message: 'Your ship has been successfully upgraded with enhanced iron harvesting capabilities. The new mining equipment will allow you to extract 25% more resources from asteroids.'
  },
  {
    id: 3,
    time: '08:45:03',
    date: 'Dec 19',
    message: 'Mission Control has detected unusual activity in sector 7. Multiple shipwrecks have been discovered containing valuable technology and resources. Your enhanced sensors indicate high concentrations of rare metals in the debris fields. Recommend immediate investigation as other ships in the area may also be tracking these signals. Exercise caution when approaching unknown vessels as some may still have active defense systems. The recovered technology could provide significant advantages for future exploration missions. Intelligence suggests these wrecks may be from an advanced civilization that once inhabited this region of space. Archaeological data indicates they possessed superior propulsion systems and energy weapons far beyond our current capabilities.'
  }
];

const HomePage: React.FC = () => {
  return (
    <AuthenticatedLayout>
      <div className="home-page">
        <div className="home-container">
          <div className="notifications-table-container">
            <table className="notifications-table">
              <thead>
                <tr>
                  <th colSpan={2} className="notifications-header">Notifications</th>
                </tr>
              </thead>
              <tbody>
                {dummyMessages.map(message => (
                  <tr key={message.id} className="notification-row">
                    <td className="time-cell">
                      <div className="time-line">{message.time}</div>
                      <div className="date-line">{message.date}</div>
                    </td>
                    <td className="message-cell">
                      {message.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default HomePage;