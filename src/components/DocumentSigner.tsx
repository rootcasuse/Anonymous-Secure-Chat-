import React, { useState, useRef } from 'react';
import { FileText, Upload, Download, Shield, CheckCircle, XCircle, Key } from 'lucide-react';
import Button from './ui/Button';
import { useCrypto } from '../context/CryptoContext';
import { DigitalSigner } from '../utils/signing';
import { DocumentSignature } from '../types';

const DocumentSigner: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [documentSignature, setDocumentSignature] = useState<DocumentSignature | null>(null);
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const crypto = useCrypto();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
      setVerificationResult(null);
    }
  };

  const handleSignatureFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSignatureFile(file);
      setError('');
    }
  };

  const signDocument = async () => {
    if (!selectedFile || !crypto.signingKeyPair || !crypto.certificate) {
      setError('Please select a file and ensure you have a valid certificate');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const signature = await DigitalSigner.signDocument(
        selectedFile,
        crypto.signingKeyPair.privateKey,
        crypto.certificate
      );

      setDocumentSignature(signature);

      // Create and download signature file
      const signatureBlob = DigitalSigner.createSignatureFile(signature);
      const url = URL.createObjectURL(signatureBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedFile.name}.sig`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err) {
      setError('Failed to sign document. Please try again.');
      console.error('Document signing failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const verifyDocument = async () => {
    if (!selectedFile || !signatureFile) {
      setError('Please select both a document and its signature file');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Parse signature file
      const parsedSignature = await DigitalSigner.parseSignatureFile(signatureFile);
      if (!parsedSignature) {
        setError('Invalid signature file format');
        setIsProcessing(false);
        return;
      }

      // Verify certificate
      const isCertValid = await crypto.verifyCertificate(parsedSignature.certificate);
      if (!isCertValid) {
        setError('Invalid or expired certificate');
        setVerificationResult(false);
        setIsProcessing(false);
        return;
      }

      // Import signer's public key
      const signerPublicKey = await crypto.importPublicKey(parsedSignature.certificate.publicKey);

      // Verify document signature
      const isValid = await DigitalSigner.verifyDocumentSignature(
        selectedFile,
        parsedSignature,
        signerPublicKey
      );

      setVerificationResult(isValid);
      setDocumentSignature(parsedSignature);

    } catch (err) {
      setError('Failed to verify document. Please check your files and try again.');
      console.error('Document verification failed:', err);
      setVerificationResult(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Document Signer</h1>
        <p className="text-gray-400">Sign and verify documents with digital certificates</p>
      </div>

      {/* File Selection */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Upload className="w-5 h-5 mr-2" />
          Select Document
        </h2>
        
        <div className="space-y-4">
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="secondary"
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              Choose File to Sign/Verify
            </Button>
          </div>

          {selectedFile && (
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{selectedFile.name}</p>
                  <p className="text-sm text-gray-400">
                    {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Unknown type'}
                  </p>
                </div>
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Document Signing */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Shield className="w-5 h-5 mr-2" />
          Sign Document
        </h2>
        
        <div className="space-y-4">
          {crypto.certificate && (
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Key className="w-5 h-5 text-green-400" />
                <div>
                  <p className="font-medium text-white">Certificate: {crypto.certificate.subject}</p>
                  <p className="text-sm text-gray-400">
                    Issued: {formatDate(crypto.certificate.issuedAt)} • 
                    Expires: {formatDate(crypto.certificate.expiresAt)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={signDocument}
            disabled={!selectedFile || !crypto.certificate || isProcessing}
            isLoading={isProcessing}
            className="w-full"
          >
            <Shield className="w-4 h-4 mr-2" />
            Sign Document
          </Button>

          {documentSignature && verificationResult === null && (
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-medium">Document signed successfully!</span>
              </div>
              <p className="text-sm text-gray-400 mt-2">
                Signature file has been downloaded. Share it along with your document for verification.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Document Verification */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <CheckCircle className="w-5 h-5 mr-2" />
          Verify Document
        </h2>
        
        <div className="space-y-4">
          <div>
            <input
              type="file"
              ref={signatureInputRef}
              onChange={handleSignatureFileSelect}
              className="hidden"
              accept=".sig,.json"
            />
            <Button
              onClick={() => signatureInputRef.current?.click()}
              variant="secondary"
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              Choose Signature File (.sig)
            </Button>
          </div>

          {signatureFile && (
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{signatureFile.name}</p>
                  <p className="text-sm text-gray-400">
                    {formatFileSize(signatureFile.size)}
                  </p>
                </div>
                <Key className="w-8 h-8 text-gray-400" />
              </div>
            </div>
          )}

          <Button
            onClick={verifyDocument}
            disabled={!selectedFile || !signatureFile || isProcessing}
            isLoading={isProcessing}
            className="w-full"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Verify Document
          </Button>

          {/* Verification Result */}
          {verificationResult !== null && (
            <div className={`border rounded-lg p-4 ${
              verificationResult 
                ? 'bg-green-900/20 border-green-700' 
                : 'bg-red-900/20 border-red-700'
            }`}>
              <div className="flex items-center space-x-2">
                {verificationResult ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                <span className={`font-medium ${
                  verificationResult ? 'text-green-400' : 'text-red-400'
                }`}>
                  {verificationResult ? 'Document verification successful!' : 'Document verification failed!'}
                </span>
              </div>
              
              {documentSignature && (
                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-gray-300">
                    <strong>Signer:</strong> {documentSignature.certificate.subject}
                  </p>
                  <p className="text-gray-300">
                    <strong>Signed:</strong> {formatDate(documentSignature.timestamp)}
                  </p>
                  <p className="text-gray-300">
                    <strong>Document Hash:</strong> 
                    <span className="font-mono text-xs ml-2 break-all">
                      {documentSignature.documentHash}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 font-medium">Error</span>
          </div>
          <p className="text-red-300 mt-1">{error}</p>
        </div>
      )}
    </div>
  );
};

export default DocumentSigner;