import React, { useState, useEffect } from 'react';
import './wilderNames.css';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase/firebase';
import CryptoJS from 'crypto-js';

const WilderNames = () => {
  const [currentStep, setCurrentStep] = useState('welcome'); // welcome, selectName, selectRecipient, complete
  const [selectedName, setSelectedName] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [completionCount, setCompletionCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  const familyMembers = ['Jonny', 'Roz', 'Jack', 'Oscar', 'Rowan', 'Ross', 'Hannah'];
  const totalMembers = familyMembers.length;

  // Encryption key (in production, this should be more secure)
  const encryptionKey = 'wilder2024Key';

  useEffect(() => {
    fetchCompletionCount();
  }, []);

  const encryptData = (data) => {
    return CryptoJS.AES.encrypt(JSON.stringify(data), encryptionKey).toString();
  };

  const decryptData = (encryptedData) => {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, encryptionKey);
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch {
      return null;
    }
  };

  const findLastRecipient = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'wilder'));
      const assignedRecipients = [];
      
      // Decrypt all entries and collect the recipients
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const decryptedData = decryptData(data.data);
        if (decryptedData && decryptedData.recipient) {
          assignedRecipients.push(decryptedData.recipient);
        }
      });
      
      // Find who is NOT in the assigned recipients list
      const unassignedPerson = familyMembers.find(member => 
        !assignedRecipients.includes(member)
      );
      
      return unassignedPerson || 'Unknown';
    } catch (error) {
      console.error('Error finding last recipient:', error);
      return 'Unknown';
    }
  };

  const fetchCompletionCount = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'wilder'));
      setCompletionCount(querySnapshot.size);
    } catch (error) {
      console.error('Error fetching completion count:', error);
    }
  };

  const checkIfUserCompleted = async (name) => {
    try {
      const docRef = doc(db, 'wilder', name);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      console.error('Error checking user completion:', error);
      return false;
    }
  };

  const savewilder = async () => {
    if (!selectedName || !selectedRecipient) return;

    setLoading(true);
    try {
      // Check if user already completed
      const alreadyCompleted = await checkIfUserCompleted(selectedName);
      if (alreadyCompleted) {
        alert('You have completed the Wilder selection!');
        setLoading(false);
        return;
      }

      // Encrypt the data
      const dataToEncrypt = {
        giver: selectedName,
        recipient: selectedRecipient,
        timestamp: new Date().toISOString()
      };

      const encryptedData = encryptData(dataToEncrypt);

      // Save to Firestore
      await setDoc(doc(db, 'wilder', selectedName), {
        data: encryptedData,
        createdAt: serverTimestamp()
      });

      setHasCompleted(true);
      setCurrentStep('complete');
      fetchCompletionCount();
    } catch (error) {
      console.error('Error saving data:', error);
      alert('Error saving your selection. Please try again.');
    }
    setLoading(false);
  };

  const handleNameSelection = async (name) => {
    setSelectedName(name);
    
    // Check if this user has already completed
    const completed = await checkIfUserCompleted(name);
    if (completed) {
      setHasCompleted(true);
      setCurrentStep('complete');
      return;
    }
    
    // Check if this is the last person (6/7 complete)
    if (completionCount === totalMembers - 1) {
      // This is the reveal mode for the last person
      const lastRecipient = await findLastRecipient();
      setSelectedRecipient(lastRecipient);
      
      // Check if they got themselves - show special message
      if (lastRecipient === name) {
        setCurrentStep('selfAssigned');
      } else {
        setCurrentStep('reveal');
      }
    } else {
      setCurrentStep('selectRecipient');
    }
  };

  const renderWelcome = () => (
    <div className="content-section">
      <div className="completion-counter">
        <span className="counter-text">{completionCount}/{totalMembers} Complete</span>
      </div>
      <div className="welcome-message">
        <p>Help us figure out the Wilder name assignments!</p>
      </div>
      <button 
        className="primary-button"
        onClick={() => setCurrentStep('selectName')}
      >
        Let's Begin!
      </button>
    </div>
  );

  const renderNameSelection = () => (
    <div className="content-section">
      <div className="completion-counter">
        <span className="counter-text">{completionCount}/{totalMembers} Complete</span>
      </div>
      <h2>First, who are you?</h2>
      <div className="name-grid">
        {familyMembers.map((name) => (
          <button
            key={name}
            className="name-button"
            onClick={() => handleNameSelection(name)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );

  const renderRecipientSelection = () => {
    const otherMembers = familyMembers.filter(name => name !== selectedName);
    
    return (
      <div className="content-section">
        <div className="completion-counter">
          <span className="counter-text">{completionCount}/{totalMembers} Complete</span>
        </div>
        <h2>Hi {selectedName}! Who do you have?</h2>
        <div className="name-grid">
          {otherMembers.map((name) => (
            <button
              key={name}
              className={`name-button ${selectedRecipient === name ? 'selected' : ''}`}
              onClick={() => setSelectedRecipient(name)}
            >
              {name}
            </button>
          ))}
        </div>
        {selectedRecipient && (
          <button 
            className="primary-button submit-button"
            onClick={savewilder}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Submit'}
          </button>
        )}
      </div>
    );
  };

  const renderReveal = () => (
    <div className="content-section">
      <div className="completion-counter">
        <span className="counter-text">{completionCount}/{totalMembers} Complete</span>
      </div>
      <h2>🎉 Reveal Time, {selectedName}!</h2>
      <div className="reveal-message">
        <p>Everyone else has completed their selections.</p>
        <p>By process of elimination...</p>
        <div className="reveal-box">
          <h3>You have:</h3>
          <div className="revealed-name">
            {selectedRecipient}
          </div>
        </div>
        <p>🎁 Happy Wilder!</p>
      </div>
      <button 
        className="primary-button"
        onClick={savewilder}
        disabled={loading}
      >
        {loading ? 'Confirming...' : 'Confirm & Complete'}
      </button>
    </div>
  );

  const renderComplete = () => (
    <div className="content-section">
      <div className="completion-counter">
        <span className="counter-text">{completionCount}/{totalMembers} Complete</span>
      </div>
      {hasCompleted ? (
        <div className="completion-message">
          <h2>✅ Completed!</h2>
          <p>You've submitted your Wilder information.</p>
        </div>
      ) : (
        <div className="completion-message">
          <h2>🎉 Thank you!</h2>
          <p>Your Wilder information has been securely recorded.</p>
          <p>Current progress: {completionCount}/{totalMembers} people have completed this.</p>
        </div>
      )}
      <button 
        className="secondary-button"
        onClick={() => {
          setCurrentStep('welcome');
          setSelectedName('');
          setSelectedRecipient('');
          setHasCompleted(false);
        }}
      >
        Start Over
      </button>
    </div>
  );

  const renderSelfAssigned = () => (
    <div className="content-section">
      <div className="completion-counter">
        <span className="counter-text">{completionCount}/{totalMembers} Complete</span>
      </div>
      <h2>Oops!</h2>
      <div className="reveal-message">
        <p>Oh no! You've drawn yourself, {selectedName}!</p>
        <div className="reveal-box">
          <h3>🎲 Assignment Conflict</h3>
          <p style={{margin: 0, fontSize: '1.1rem'}}>Please message the family chat to propose a redraw</p>
        </div>
      </div>
      <button 
        className="secondary-button"
        onClick={() => {
          setCurrentStep('welcome');
          setSelectedName('');
          setSelectedRecipient('');
          setHasCompleted(false);
        }}
      >
        Back to Start
      </button>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'welcome':
        return renderWelcome();
      case 'selectName':
        return renderNameSelection();
      case 'selectRecipient':
        return renderRecipientSelection();
      case 'reveal':
        return renderReveal();
      case 'selfAssigned':
        return renderSelfAssigned();
      case 'complete':
        return renderComplete();
      default:
        return renderWelcome();
    }
  };

  return (
    <div className="wilder-detector-container">
      <div className="title">
        WilderNameDetector2000™
      </div>
      
      {renderCurrentStep()}
      
      <div className="footer">
        <p>🎁 Powered by Advanced Wilder Gift Assignment Algorithm™</p>
      </div>
    </div>
  );
};

export default WilderNames;


