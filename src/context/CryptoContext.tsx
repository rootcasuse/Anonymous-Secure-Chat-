import React, { createContext, useContext, useState, ReactNode } from 'react';
import { KeyPair, EncryptedData, SigningKeyPair, Certificate } from '../types';
import { CertificateManager } from '../utils/certificates';
import { DigitalSigner } from '../utils/signing';
import { ForwardSecrecy } from '../utils/forwardSecrecy';

interface CryptoContextType {
  keyPair: KeyPair | null;
  signingKeyPair: SigningKeyPair | null;
  certificate: Certificate | null;
  sharedSecret: CryptoKey | null;
  generateKeyPair: () => Promise<KeyPair>;
  generateSigningKeyPair: () => Promise<SigningKeyPair>;
  generateCertificate: (subject: string) => Promise<Certificate>;
  generatePairingCode: () => Promise<string>;
  encryptMessage: (message: string) => Promise<EncryptedData>;
  decryptMessage: (encryptedData: EncryptedData, messageIndex?: number) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  verifyMessage: (message: string, signature: string, senderCert: Certificate) => Promise<boolean>;
  exportPublicKey: (key: CryptoKey) => Promise<string>;
  importPublicKey: (keyData: string) => Promise<CryptoKey>;
  verifyCertificate: (cert: Certificate) => Promise<boolean>;
  reset: () => void;
}

const CryptoContext = createContext<CryptoContextType | null>(null);

export const useCrypto = () => {
  const context = useContext(CryptoContext);
  if (!context) {
    throw new Error('useCrypto must be used within a CryptoProvider');
  }
  return context;
};

export const CryptoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [signingKeyPair, setSigningKeyPair] = useState<SigningKeyPair | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [sharedSecret, setSharedSecret] = useState<CryptoKey | null>(null);
  const [certificateManager] = useState(() => CertificateManager.getInstance());

  // Generate ECDH key pair for encryption
  const generateKeyPair = async (): Promise<KeyPair> => {
    const newKeyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      ['deriveKey']
    );

    const pair = {
      publicKey: newKeyPair.publicKey,
      privateKey: newKeyPair.privateKey
    };

    setKeyPair(pair);
    return pair;
  };

  // Generate ECDSA key pair for signing
  const generateSigningKeyPair = async (): Promise<SigningKeyPair> => {
    const newKeyPair = await certificateManager.generateSigningKeyPair();
    setSigningKeyPair(newKeyPair);
    return newKeyPair;
  };

  // Generate certificate for user
  const generateCertificate = async (subject: string): Promise<Certificate> => {
    if (!signingKeyPair) {
      throw new Error('Signing key pair not generated');
    }

    const cert = await certificateManager.issueCertificate(
      subject,
      signingKeyPair.publicKey
    );
    setCertificate(cert);
    return cert;
  };

  // Generate a secure random pairing code
  const generatePairingCode = async (): Promise<string> => {
    const array = new Uint8Array(4);
    window.crypto.getRandomValues(array);
    const code = Array.from(array)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
      .slice(0, 6);
    return code;
  };

  // Encrypt a message using forward secrecy
  const encryptMessage = async (message: string): Promise<EncryptedData> => {
    if (!sharedSecret) {
      throw new Error('No shared secret established');
    }

    return await ForwardSecrecy.encryptWithForwardSecrecy(message, sharedSecret);
  };

  // Decrypt a message using forward secrecy
  const decryptMessage = async (
    encryptedData: EncryptedData,
    messageIndex: number = 0
  ): Promise<string> => {
    if (!sharedSecret) {
      throw new Error('No shared secret established');
    }

    return await ForwardSecrecy.decryptWithForwardSecrecy(
      encryptedData,
      sharedSecret,
      messageIndex
    );
  };

  // Sign a message
  const signMessage = async (message: string): Promise<string> => {
    if (!signingKeyPair) {
      throw new Error('Signing key pair not generated');
    }

    return await DigitalSigner.signData(message, signingKeyPair.privateKey);
  };

  // Verify a message signature
  const verifyMessage = async (
    message: string,
    signature: string,
    senderCert: Certificate
  ): Promise<boolean> => {
    try {
      // First verify the certificate
      const isCertValid = await certificateManager.verifyCertificate(senderCert);
      if (!isCertValid) {
        return false;
      }

      // Then verify the message signature
      const senderPublicKey = await certificateManager.importPublicKey(senderCert.publicKey);
      return await DigitalSigner.verifySignature(message, signature, senderPublicKey);
    } catch (error) {
      console.error('Message verification failed:', error);
      return false;
    }
  };

  // Export public key as base64
  const exportPublicKey = async (key: CryptoKey): Promise<string> => {
    const exported = await window.crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  };

  // Import public key from base64
  const importPublicKey = async (keyData: string): Promise<CryptoKey> => {
    const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
    return window.crypto.subtle.importKey(
      'raw',
      binaryKey,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      []
    );
  };

  // Verify certificate
  const verifyCertificate = async (cert: Certificate): Promise<boolean> => {
    return await certificateManager.verifyCertificate(cert);
  };

  // Reset the crypto context
  const reset = () => {
    setKeyPair(null);
    setSigningKeyPair(null);
    setCertificate(null);
    setSharedSecret(null);
    certificateManager.reset();
    ForwardSecrecy.resetCounter();
  };

  return (
    <CryptoContext.Provider
      value={{
        keyPair,
        signingKeyPair,
        certificate,
        sharedSecret,
        generateKeyPair,
        generateSigningKeyPair,
        generateCertificate,
        generatePairingCode,
        encryptMessage,
        decryptMessage,
        signMessage,
        verifyMessage,
        exportPublicKey,
        importPublicKey,
        verifyCertificate,
        reset
      }}
    >
      {children}
    </CryptoContext.Provider>
  );
};