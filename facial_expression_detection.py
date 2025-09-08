import cv2
from deepface import DeepFace

# Initialize the webcam
cap = cv2.VideoCapture(0)


while True:
    # Capture frame-by-frame
    ret, frame = cap.read()


    if not ret:
        break


    # Perform facial expression detection using DeepFace
    result = DeepFace.analyze(frame, actions=['emotion'], enforce_detection=False)


    # Extract the detected emotion and display it on the frame
    dominant_emotion = result[0]['dominant_emotion']
    cv2.putText(frame, f"Emotion: {dominant_emotion}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)


    # Display the resulting frame
    cv2.imshow('Facial Expression Detection', frame)


    # Break the loop if the user presses the 'q' key
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break


# Release the capture object and close all windows
cap.release()
cv2.destroyAllWindows()
