'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@nextui-org/button';
import { useAdmin } from '../context/AdminContext';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Clock,
  Calendar,
  Key,
  Save,
  X,
  PlusCircle,
  Trash2,
  CheckCircle,
  ListChecks,
  Edit3,
  HelpCircle,
  ChevronDown,
  RefreshCw
} from 'lucide-react';

export default function QuizForm() {
  const { admin } = useAdmin();
  const [type, setType] = useState('mcq');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('Test your knowledge');
  const [questions, setQuestions] = useState([
    { questionText: '', answers: ['', '', '', ''], correct: [false, false, false, false], pointsForQuestion: 1 },
  ]);
  const [essayQuestion, setEssayQuestion] = useState({ questionText: '', answer: '' });
  const [timeLimit, setTimeLimit] = useState(30);
  const [password, setPassword] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mainStartTime, setMainStartTime] = useState('');
  const [mainEndTime, setMainEndTime] = useState('');
  const [startDate, setStartDate] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [intendedBatch, setIntendedBatch] = useState(''); // New state for intended batch
  const [maxRetries] = useState(3); // Set maximum retries
  const router = useRouter();

  // Set default dates when component mounts
  useEffect(() => {
    if (!startDate || !mainStartTime || !mainEndTime) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (!startDate) {
        const startDate = new Date(tomorrow);
        startDate.setHours(0, 0, 0, 0);
        setStartDate(startDate.toISOString().slice(0, 16));
      }

      if (!mainStartTime) {
        const startTime = new Date(tomorrow);
        startTime.setHours(9, 0, 0, 0);
        setMainStartTime(startTime.toISOString().slice(0, 16));
      }

      if (!mainEndTime) {
        const endTime = new Date(tomorrow);
        endTime.setHours(17, 0, 0, 0);
        setMainEndTime(endTime.toISOString().slice(0, 16));
      }
    }
  }, []);

  // Add a question to the list
  const addQuestion = (afterIndex: number | null | undefined = null) => {
    if (afterIndex === null) {
      // Add to the end (original behavior)
      setQuestions([
        ...questions,
        { questionText: '', answers: ['', '', '', ''], correct: [false, false, false, false], pointsForQuestion: 1 },
      ]);
    } else {
      // Insert after the specified index
      const newQuestions = [...questions];
      newQuestions.splice(afterIndex + 1, 0, {
        questionText: '',
        answers: ['', '', '', ''],
        correct: [false, false, false, false],
        pointsForQuestion: 1
      });
      setQuestions(newQuestions);
    }
  };

  interface Question {
    questionText: string;
    answers: string[];
    correct: boolean[];
    pointsForQuestion: number; // Optional property for points
  }

  const deleteQuestion = (index: number): void => {
    if (questions.length === 1) {
      setAlertMessage('You need at least one question');
      setShowAlert(true);
      setTimeout(() => {
        setShowAlert(false);
        setAlertMessage('');
      }, 2000);
      return;
    }

    setQuestions(prev => prev.filter((_, qIndex) => qIndex !== index));
    setAlertMessage(`Deleted question ${index + 1}`);
    setShowAlert(true);
    setTimeout(() => {
      setShowAlert(false);
      setAlertMessage('');
    }, 1500);
  };

  const handleCancel = () => {
    router.push('/dashboard');
  };

  const validateForm = () => {
    if (!title.trim()) {
      setAlertMessage('Assignment title is required.');
      setShowAlert(true);
      return false;
    }

    if (type === 'mcq') {
      if (questions.some((q) => !q.questionText.trim())) {
        setAlertMessage('Each question must have text.');
        setShowAlert(true);
        return false;
      }
      if (questions.some((q) => q.answers.some((answer) => !answer.trim()))) {
        setAlertMessage('All answers must have text.');
        setShowAlert(true);
        return false;
      }

      // Fix for the correct answer validation
      const invalidQuestions = questions.filter(q => !q.correct.includes(true));
      if (invalidQuestions.length > 0) {
        setAlertMessage('Each question must have at least one correct answer.');
        setShowAlert(true);
        return false;
      }
    } else if (type === 'essay') {
      if (!essayQuestion.questionText.trim() || !essayQuestion.answer.trim()) {
        setAlertMessage('Essay question and answer are required.');
        setShowAlert(true);
        return false;
      }
    }

    if (!password.trim()) {
      setAlertMessage('Password is required.');
      setShowAlert(true);
      return false;
    }

    return true;
  };

  // Function to handle API request with retry logic
  interface SubmitWithRetryParams {
    endpoint: string;
    data: Record<string, unknown>;
    token: string;
  }

  type SubmitWithRetryResponse = {
    [key: string]: unknown;
    data: Record<string, unknown>;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    config: Record<string, unknown>;
  }

  const submitWithRetry = async (
    endpoint: SubmitWithRetryParams['endpoint'],
    data: SubmitWithRetryParams['data'],
    token: SubmitWithRetryParams['token']
  ): Promise<SubmitWithRetryResponse> => {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= maxRetries) {
      try {
        if (attempt > 0) {
          setRetryCount(attempt);
          setAlertMessage(`Retrying... Attempt ${attempt} of ${maxRetries}`);
          // No need to setShowAlert(true) as it should already be showing
        }

        // Increase timeout for each retry
        const timeout = 20000 + (attempt * 10000); // 20s, 30s, 40s...

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out')), timeout)
        );

        // Try the request with the current timeout
        const response = await Promise.race([
          axios.post<SubmitWithRetryResponse>(endpoint, data, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }),
          timeoutPromise
        ]);

        // Convert headers to Record<string, string> and return formatted response
        return {
          data: response.data,
          status: response.status,
          statusText: response.status.toString(),
          headers: Object.entries(response.headers).reduce((acc, [key, value]) => {
            acc[key] = value?.toString() || '';
            return acc;
          }, {} as Record<string, string>),
          config: response.config as unknown as Record<string, unknown>
        };
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt + 1} failed:`, error);

        // If it's not a timeout, or we're on our last retry, break out of the loop
        if ((error as Error).message !== 'Request timed out' || attempt === maxRetries) {
          break;
        }

        // Wait before retrying (backoff strategy)
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
        attempt++;
      }
    }

    // If we get here, all attempts failed
    throw lastError;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setRetryCount(0);
    setAlertMessage('Processing your request...');
    setShowAlert(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setAlertMessage('No authentication token found. Please login.');
        setShowAlert(true);
        router.push('/login');
        return;
      }

      // Determine API URL
      let apiUrl;
      if (typeof window !== 'undefined') {
        if (window.location.hostname === 'localhost') {
          apiUrl = 'http://localhost:4000';
        } else {
          apiUrl = process.env.NEXT_PUBLIC_DEPLOYMENT_URL;
        }
      }

      // Format dates
      const formatDate = (dateString: any) => {
        if (!dateString.includes('Z')) {
          return new Date(dateString).toISOString();
        }
        return dateString;
      };

      // Create the payload
      interface AssignmentData {
        title: string;
        description: string;
        timeLimit: number;
        password: string;
        teacherId: string | undefined;
        startDate: any;
        endDate: any;
        intendedBatch: number;
        guidelines: string[];
        questions?: Array<{
          questionText: string;
          options?: Array<{ text: string; isCorrect: boolean }>;
          answer?: string; // Added for essay questions
          pointsForQuestion: number; // Added for points
        }>;
      }

      const assignmentData: AssignmentData = {
        title,
        description,
        timeLimit: timeLimit,
        password,
        intendedBatch: parseInt(intendedBatch) || 0, // Convert to number, default to 0 if parsing fails
        teacherId: admin?._id,
        startDate: formatDate(startDate),
        endDate: formatDate(mainEndTime), // Use `mainEndTime` as `endDate`
        guidelines: ["Read all questions carefully before answering", "Manage your time effectively", "Once submitted, you cannot change your answers", "Do not refresh the page during the quiz"],
        questions: [], // Initialize as empty, will be filled based on type
      };

      if (type === 'mcq') {
        // For MCQ quizzes
        assignmentData.questions = questions.map((q) => ({
          questionText: q.questionText,
          options: q.answers.map((answer, idx) => ({
            text: answer,
            isCorrect: q.correct[idx],
          })),
          pointsForQuestion: q.pointsForQuestion, // Include points for question
        }));

        console.log("Sending MCQ data:", JSON.stringify(assignmentData, null, 2));

        const endpoint = `${apiUrl}/api/v1/create-assignment`;
        console.log("Sending to endpoint:", endpoint);

        try {
          const response = await submitWithRetry(endpoint, assignmentData as unknown as Record<string, unknown>, token);
          console.log(response);
          if (response.status === 201 || response.data.success) {
            setAlertMessage('Quiz created successfully!');
            setShowAlert(true);
            setTimeout(() => {
              setShowAlert(false);
              router.push('/dashboard');
            }, 1500);
          }
        } catch (error) {
          throw error; // Rethrow the error to be caught in the outer catch block
        }
      } else {
        // For Essay
        assignmentData.questions = [
          {
            questionText: essayQuestion.questionText,
            answer: essayQuestion.answer,
            pointsForQuestion: 1, // Default value for essay question
          },
        ];

        console.log("Sending Essay data:", JSON.stringify(assignmentData, null, 2));

        const endpoint = `${apiUrl}/api/v1/essay/create`;
        console.log("Sending to endpoint:", endpoint);

        const response = await submitWithRetry(endpoint, assignmentData as unknown as Record<string, unknown>, token);

        if (response && response.data) {
          setAlertMessage('Essay created successfully!');
          setShowAlert(true);
          setTimeout(() => {
            setShowAlert(false);
            router.push('/dashboard');
          }, 1500);
        }
      }
    } catch (error) {
      console.error('Error creating assignment:', error);

      if (error instanceof Error && error.message === 'Request timed out') {
        setAlertMessage(`Request timed out after ${maxRetries} attempts. The server is not responding.`);
      } else if (axios.isAxiosError(error) && error.response) {
        console.error('Server error details:', error.response.data);
        setAlertMessage(`Error (${error.response.status}): ${error.response.data?.message || 'Server returned an error'}`);
      } else if (axios.isAxiosError(error) && error.request) {
        setAlertMessage('No response received from server. Check your network connection.');
      } else {
        if (error instanceof Error) {
          setAlertMessage(`Error: ${error.message}`);
        } else {
          setAlertMessage('An unknown error occurred.');
        }
      }

      setShowAlert(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const setMarks = (value: string, questionIndex: number) => {
    const marks = parseInt(value);
    if (isNaN(marks) || marks < 0) return; // Validate input

    setQuestions(prev => {
      const updated = [...prev];
      if (updated[questionIndex]) {
        updated[questionIndex].pointsForQuestion = marks;
      }
      return updated;
    });
  };


  return (

    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-4 md:p-8">
      {/* Decorative elements */}
      <div className="fixed top-20 right-40 w-64 h-64 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
      <div className="fixed bottom-40 left-20 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-5xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden relative z-10"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-green-500 p-6 text-white">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center">
              {type === 'mcq' ?
                <ListChecks className="mr-3 h-6 w-6" /> :
                <Edit3 className="mr-3 h-6 w-6" />
              }
              Create {type === 'mcq' ? 'Quiz' : 'Essay'} Assignment
            </h1>

            {/* Dropdown menu section */}
            <div className="relative">
              <motion.button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl backdrop-blur-sm transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span>Assignment Type</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </motion.button>

              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg z-50 overflow-hidden border border-gray-100"
                  >
                    <motion.button
                      whileHover={{ backgroundColor: '#e6f7ff' }}
                      className={`w-full text-left px-4 py-3 flex items-center space-x-2 ${type === 'mcq'
                        ? 'bg-blue-100 text-blue-600 font-medium'
                        : 'text-gray-700 bg-white'
                        }`}
                      onClick={() => {
                        setType('mcq');
                        setShowDropdown(false);
                      }}
                    >
                      <ListChecks className={`h-5 w-5 ${type === 'mcq' ? 'text-blue-600' : 'text-gray-600'}`} />
                      <span>Multiple Choice</span>
                      {type === 'mcq' && <CheckCircle className="h-4 w-4 ml-auto text-blue-600" />}
                    </motion.button>

                    <motion.button
                      whileHover={{ backgroundColor: '#e6f7ff' }}
                      className={`w-full text-left px-4 py-3 flex items-center space-x-2 ${type === 'essay'
                        ? 'bg-blue-100 text-blue-600 font-medium'
                        : 'text-gray-700 bg-white'
                        }`}
                      onClick={() => {
                        setType('essay');
                        setShowDropdown(false);
                      }}
                    >
                      <Edit3 className={`h-5 w-5 ${type === 'essay' ? 'text-blue-600' : 'text-gray-600'}`} />
                      <span>Essay</span>
                      {type === 'essay' && <CheckCircle className="h-4 w-4 ml-auto text-blue-600" />}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <p className="mt-2 text-blue-50">Create interactive assignments to engage your students</p>
        </div>

        {/* Alert popup */}
        <AnimatePresence>
          {showAlert && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            >
              <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full">
                {alertMessage.includes('Retrying') && (
                  <div className="flex justify-center mb-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <RefreshCw className="h-6 w-6 text-blue-500" />
                    </motion.div>
                  </div>
                )}

                <p className={`text-lg ${alertMessage.includes('Error') || alertMessage.includes('timed out')
                  ? 'text-red-600'
                  : alertMessage.includes('Processing') || alertMessage.includes('Retrying')
                    ? 'text-blue-600'
                    : 'text-green-600'
                  } font-medium mb-4 text-center`}>
                  {alertMessage}
                </p>

                {/* Only show the button for non-processing states */}
                {!alertMessage.includes('Processing') && !alertMessage.includes('Retrying') && (
                  <Button
                    color={
                      alertMessage.includes('Error') || alertMessage.includes('timed out')
                        ? "danger"
                        : "success"
                    }
                    className="w-full"
                    onClick={() => setShowAlert(false)}
                  >
                    OK
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-8">
          {/* Title and Description */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700">Assignment Title</label>
              <input
                type="text"
                placeholder={type === 'mcq' ? "e.g., Geography Quiz" : "e.g., Critical Analysis Essay"}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring focus:ring-blue-200 transition-all"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700">Assignment Description</label>
              <textarea
                placeholder="Provide instructions for your students"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring focus:ring-blue-200 transition-all min-h-[100px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Time and Date Settings */}
          <div className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <Clock className="mr-2 h-5 w-5 text-blue-600" />
              Time Settings
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">
                  Time Limit (Minutes)
                </label>
                <input
                  type="number"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  className="p-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 focus:ring focus:ring-blue-200 transition-all w-full"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">
                  Start Date
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="p-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 focus:ring focus:ring-blue-200 transition-all w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">
                  End Date
                </label>
                <input
                  type="datetime-local"
                  value={mainEndTime}
                  onChange={(e) => setMainEndTime(e.target.value)}
                  className="p-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 focus:ring focus:ring-blue-200 transition-all w-full"
                />
              </div>
            </div>
          </div>

          {/* Questions Section */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                {type === 'mcq' ?
                  <HelpCircle className="mr-2 h-5 w-5 text-blue-600" /> :
                  <FileText className="mr-2 h-5 w-5 text-blue-600" />
                }
                {type === 'mcq' ? 'Quiz Questions' : 'Essay Question'}
              </h2>

              {type === 'mcq' && (
                <motion.button
                  onClick={() => addQuestion()}
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Add Question</span>
                </motion.button>
              )}
            </div>

            <AnimatePresence mode="popLayout">
              {type === 'mcq' ? (
                questions.map((q, qIndex) => (
                  <motion.div
                    key={qIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="mb-8 p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium text-gray-800">Question {qIndex + 1}</h3>
                      <motion.button
                        onClick={() => deleteQuestion(qIndex)}
                        className="text-red-500 hover:text-red-700 flex items-center space-x-1"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="text-sm">Delete</span>
                      </motion.button>
                    </div>

                    <div className="mb-4">
                      <input
                        type="text"
                        placeholder="Enter your question"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring focus:ring-blue-200 transition-all"
                        value={q.questionText}
                        onChange={(e) =>
                          setQuestions((prev) => {
                            const updated = [...prev];
                            updated[qIndex].questionText = e.target.value;
                            return updated;
                          })
                        }
                      />
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-700">Answer Options:</p>
                      {q.answers.map((answer, aIndex) => (
                        <div key={aIndex} className="flex items-center space-x-3">
                          <div className="flex-1">
                            <div className="relative">
                              <input
                                type="text"
                                placeholder={`Option ${aIndex + 1}`}
                                className="w-full pl-3 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring focus:ring-blue-200 transition-all"
                                value={answer}
                                onChange={(e) =>
                                  setQuestions((prev) => {
                                    const updated = [...prev];
                                    updated[qIndex].answers[aIndex] = e.target.value;
                                    return updated;
                                  })
                                }
                              />
                              {q.correct[aIndex] && (
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                  <CheckCircle className="h-5 w-5 text-green-500" />
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Fixed checkbox implementation */}
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`q${qIndex}-a${aIndex}`}
                              checked={q.correct[aIndex]}
                              onChange={(e) => {
                                setQuestions((prev) => {
                                  const updated = [...prev];
                                  updated[qIndex].correct[aIndex] = e.target.checked;
                                  return updated;
                                });
                              }}
                              className="w-4 h-4 text-green-600 focus:ring-green-500 rounded"
                            />
                            <label htmlFor={`q${qIndex}-a${aIndex}`} className="text-sm font-medium text-gray-700">
                              Correct
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8">
                      <label className="flex items-center text-sm font-semibold mb-2 text-gray-700">
                        <Key className="mr-2 h-4 w-4 text-blue-600" />
                        Marks For the Question
                      </label>
                      <input
                        type="number"
                        placeholder="Enter Marks"
                        value={q.pointsForQuestion}
                        onChange={(e) => setMarks(e.target.value, qIndex)}
                        className="p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring focus:ring-blue-200 transition-all w-full md:w-1/3"
                      />
                    </div>

                    {/* Add per-question "Add More Questions" button */}
                    {type === 'mcq' && (
                      <div className="mt-4 flex justify-center">
                        <motion.button
                          onClick={() => addQuestion(qIndex)}
                          className="flex items-center space-x-2 text-green-600 hover:text-green-700 px-4 py-2 rounded-xl bg-green-50 hover:bg-green-100 transition-colors"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <PlusCircle className="h-4 w-4" />
                          <span>Add Question</span>
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mb-8 p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2 text-gray-700">Question</label>
                    <textarea
                      placeholder="Enter your essay question here..."
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring focus:ring-blue-200 transition-all min-h-[100px]"
                      value={essayQuestion.questionText}
                      onChange={(e) => setEssayQuestion({ ...essayQuestion, questionText: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Model Answer (for grading)</label>
                    <textarea
                      placeholder="Provide a model answer for reference..."
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring focus:ring-blue-200 transition-all min-h-[200px]"
                      value={essayQuestion.answer}
                      onChange={(e) => setEssayQuestion({ ...essayQuestion, answer: e.target.value })}
                    />
                    <p className="mt-1 text-sm text-gray-500">This answer will be used as a reference for grading</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Password */}
          <div className="mt-8">
            <label className="flex items-center text-sm font-semibold mb-2 text-gray-700">
              <Key className="mr-2 h-4 w-4 text-blue-600" />
              Assignment Password
            </label>
            <input
              type="password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring focus:ring-blue-200 transition-all w-full md:w-1/3"
            />
            <p className="mt-1 text-sm text-gray-500">Students will need this password to access the assignment</p>
          </div>

          {/* Intended Batch */}
          <div className='mt-8'>
            <label className="flex items-center text-sm font-semibold mb-2 text-gray-700">
              <ListChecks className="mr-2 h-4 w-4 text-blue-600" />
              Intended Batch
            </label>
            <input
              type="text"
              placeholder="Enter intended batch (e.g., 2023-2024)"
              value={intendedBatch}
              onChange={(e) => setIntendedBatch(e.target.value)}
              className="p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring focus:ring-blue-200 transition-all w-full md:w-1/3"
            />
          </div>

          {/* Buttons */}
          <div className="mt-12 flex flex-col md:flex-row gap-4 justify-end">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                color="danger"
                variant="flat"
                onClick={handleCancel}
                className="flex items-center justify-center w-full md:w-auto"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                color="primary"
                onClick={handleSubmit}
                isLoading={isSubmitting}
                className="bg-gradient-to-r from-blue-500 to-green-500 text-white flex items-center justify-center w-full md:w-auto"
              >
                {!isSubmitting && <Save className="h-4 w-4 mr-2" />}
                {isSubmitting ? (retryCount > 0 ? `Retrying... (${retryCount}/${maxRetries})` : 'Creating...') : `Create ${type === 'mcq' ? 'Quiz' : 'Essay'}`}
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}