import React, { createContext, useState, useContext, useRef } from 'react';

const CameraContext = createContext();

export const CameraProvider = ({ children }) => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const cameraRef = useRef(null);

  const activateCamera = () => setIsCameraActive(true);
  const deactivateCamera = () => setIsCameraActive(false);

  return (
    <CameraContext.Provider
      value={{
        isCameraActive,
        cameraRef,
        activateCamera,
        deactivateCamera,
      }}
    >
      {children}
    </CameraContext.Provider>
  );
};

export const useCamera = () => useContext(CameraContext);
