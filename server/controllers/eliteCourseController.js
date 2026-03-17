const { EliteCourse, EliteCourseLesson, EliteCourseEnrollment, EliteLessonProgress, EliteCourseQuiz, EliteQuizQuestion, EliteQuizAttempt, EliteUser, Admin } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../models');

// Helper function to recalculate enrollment progress
async function recalculateProgress(enrollmentId) {
  const enrollment = await EliteCourseEnrollment.findByPk(enrollmentId);
  if (!enrollment) return;
  const totalLessons = await EliteCourseLesson.count({ where: { courseId: enrollment.courseId } });
  if (totalLessons === 0) {
    await enrollment.update({ progressPercent: 0 });
    return;
  }
  const completedLessons = await EliteLessonProgress.count({ where: { enrollmentId, completed: true } });
  const progressPercent = Math.round((completedLessons / totalLessons) * 100);
  await enrollment.update({ progressPercent });
}

// ==================== Admin Course CRUD ====================

// GET /api/elite/courses - Get all courses
exports.getAllCourses = async (req, res) => {
  try {
    const courses = await EliteCourse.findAll({
      include: [
        { model: Admin, as: 'courseCreator', attributes: ['adminId', 'fullName'] },
        { model: EliteCourseLesson, as: 'lessons', attributes: ['lessonId'] },
        { model: EliteCourseEnrollment, as: 'enrollments', attributes: ['enrollmentId'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/elite/courses/:courseId - Get course by ID
exports.getCourseById = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await EliteCourse.findByPk(courseId, {
      include: [
        { model: Admin, as: 'courseCreator', attributes: ['adminId', 'fullName'] },
        {
          model: EliteCourseLesson, as: 'lessons',
          order: [['order', 'ASC']],
          include: [{ model: EliteLessonProgress, as: 'progress' }]
        },
        {
          model: EliteCourseEnrollment, as: 'enrollments',
          include: [{ model: EliteUser, as: 'eliteUser', attributes: ['firstName', 'lastName', 'uniqueId', 'email'] }]
        },
        {
          model: EliteCourseQuiz, as: 'quiz',
          include: [{
            model: EliteQuizQuestion, as: 'questions',
            order: [['order', 'ASC']]
          }]
        }
      ],
      order: [
        [{ model: EliteCourseLesson, as: 'lessons' }, 'order', 'ASC'],
        [{ model: EliteCourseQuiz, as: 'quiz' }, { model: EliteQuizQuestion, as: 'questions' }, 'order', 'ASC']
      ]
    });

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST /api/elite/courses - Create course
exports.createCourse = async (req, res) => {
  try {
    const { title, description, thumbnail, startDate, endDate, inactivityDays, passingScore, createdById } = req.body;

    const course = await EliteCourse.create({
      title, description, thumbnail, startDate, endDate, inactivityDays, passingScore, createdById
    });

    const courseWithCreator = await EliteCourse.findByPk(course.courseId, {
      include: [{ model: Admin, as: 'courseCreator', attributes: ['adminId', 'fullName'] }]
    });

    res.status(201).json(courseWithCreator);
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PUT /api/elite/courses/:courseId - Update course
exports.updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, description, thumbnail, startDate, endDate, status, inactivityDays, passingScore } = req.body;

    const course = await EliteCourse.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    await course.update({ title, description, thumbnail, startDate, endDate, status, inactivityDays, passingScore });

    const updatedCourse = await EliteCourse.findByPk(courseId, {
      include: [{ model: Admin, as: 'courseCreator', attributes: ['adminId', 'fullName'] }]
    });

    res.json(updatedCourse);
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE /api/elite/courses/:courseId - Delete course
exports.deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await EliteCourse.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    await course.destroy();

    res.status(200).json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PATCH /api/elite/courses/:courseId/status - Update course status
exports.updateCourseStatus = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { status } = req.body;

    const validStatuses = ['draft', 'active', 'completed', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const course = await EliteCourse.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    await course.update({ status });

    res.json(course);
  } catch (error) {
    console.error('Error updating course status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ==================== Lesson Management ====================

// POST /api/elite/courses/:courseId/lessons - Add lesson
exports.addLesson = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, description, materials } = req.body;

    const course = await EliteCourse.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Auto-set order to max+1
    const maxOrder = await EliteCourseLesson.max('order', { where: { courseId } });
    const order = (maxOrder || 0) + 1;

    const lesson = await EliteCourseLesson.create({ courseId, title, description, materials, order });

    // Create lesson progress records for all existing enrollments
    const enrollments = await EliteCourseEnrollment.findAll({ where: { courseId } });
    if (enrollments.length > 0) {
      const progressRecords = enrollments.map(enrollment => ({
        enrollmentId: enrollment.enrollmentId,
        lessonId: lesson.lessonId
      }));
      await EliteLessonProgress.bulkCreate(progressRecords);

      // Recalculate progress for all enrollments
      for (const enrollment of enrollments) {
        await recalculateProgress(enrollment.enrollmentId);
      }
    }

    res.status(201).json(lesson);
  } catch (error) {
    console.error('Error adding lesson:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PUT /api/elite/courses/:courseId/lessons/:lessonId - Update lesson
exports.updateLesson = async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;
    const { title, description, materials, order } = req.body;

    const lesson = await EliteCourseLesson.findOne({ where: { lessonId, courseId } });
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    await lesson.update({ title, description, materials, order });

    res.json(lesson);
  } catch (error) {
    console.error('Error updating lesson:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE /api/elite/courses/:courseId/lessons/:lessonId - Delete lesson
exports.deleteLesson = async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;

    const lesson = await EliteCourseLesson.findOne({ where: { lessonId, courseId } });
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    await lesson.destroy();

    // Recalculate progress for all enrollments of this course
    const enrollments = await EliteCourseEnrollment.findAll({ where: { courseId } });
    for (const enrollment of enrollments) {
      await recalculateProgress(enrollment.enrollmentId);
    }

    res.status(200).json({ message: 'Lesson deleted successfully' });
  } catch (error) {
    console.error('Error deleting lesson:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PATCH /api/elite/courses/:courseId/lessons/reorder - Reorder lessons
exports.reorderLessons = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { lessonOrders } = req.body;

    if (!lessonOrders || !Array.isArray(lessonOrders)) {
      return res.status(400).json({ message: 'lessonOrders array is required' });
    }

    for (const item of lessonOrders) {
      await EliteCourseLesson.update(
        { order: item.order },
        { where: { lessonId: item.lessonId, courseId } }
      );
    }

    const lessons = await EliteCourseLesson.findAll({
      where: { courseId },
      order: [['order', 'ASC']]
    });

    res.json(lessons);
  } catch (error) {
    console.error('Error reordering lessons:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ==================== Enrollment Management ====================

// POST /api/elite/courses/:courseId/enroll - Enroll users
exports.enrollUsers = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { eliteIds } = req.body;

    if (!eliteIds || !Array.isArray(eliteIds) || eliteIds.length === 0) {
      return res.status(400).json({ message: 'eliteIds array is required' });
    }

    const course = await EliteCourse.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const lessons = await EliteCourseLesson.findAll({ where: { courseId } });
    const createdEnrollments = [];

    for (const eliteId of eliteIds) {
      // Check if already enrolled
      const existing = await EliteCourseEnrollment.findOne({ where: { courseId, eliteId } });
      if (existing) continue;

      const enrollment = await EliteCourseEnrollment.create({ courseId, eliteId });

      // Create lesson progress records for all existing lessons
      if (lessons.length > 0) {
        const progressRecords = lessons.map(lesson => ({
          enrollmentId: enrollment.enrollmentId,
          lessonId: lesson.lessonId
        }));
        await EliteLessonProgress.bulkCreate(progressRecords);
      }

      createdEnrollments.push(enrollment);
    }

    // Fetch with user info
    const enrollmentIds = createdEnrollments.map(e => e.enrollmentId);
    const enrollments = await EliteCourseEnrollment.findAll({
      where: { enrollmentId: { [Op.in]: enrollmentIds } },
      include: [{ model: EliteUser, as: 'eliteUser', attributes: ['firstName', 'lastName', 'uniqueId', 'email'] }]
    });

    res.status(201).json(enrollments);
  } catch (error) {
    console.error('Error enrolling users:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE /api/elite/courses/:courseId/enrollments/:enrollmentId - Remove enrollment
exports.removeEnrollment = async (req, res) => {
  try {
    const { courseId, enrollmentId } = req.params;

    const enrollment = await EliteCourseEnrollment.findOne({ where: { enrollmentId, courseId } });
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }

    await enrollment.destroy();

    res.status(200).json({ message: 'Enrollment removed successfully' });
  } catch (error) {
    console.error('Error removing enrollment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/elite/courses/:courseId/progress - Get course progress
exports.getCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;

    const enrollments = await EliteCourseEnrollment.findAll({
      where: { courseId },
      include: [
        { model: EliteUser, as: 'eliteUser', attributes: ['firstName', 'lastName', 'uniqueId', 'email'] },
        {
          model: EliteLessonProgress, as: 'lessonProgress',
          include: [{ model: EliteCourseLesson, as: 'lesson', attributes: ['title'] }]
        },
        { model: EliteQuizAttempt, as: 'quizAttempts' }
      ]
    });

    res.json(enrollments);
  } catch (error) {
    console.error('Error fetching course progress:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ==================== Quiz Management ====================

// PUT /api/elite/courses/:courseId/quiz - Create or update quiz
exports.createOrUpdateQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, description, timeLimit, maxAttempts, questions } = req.body;

    const course = await EliteCourse.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const [quiz, created] = await EliteCourseQuiz.findOrCreate({
      where: { courseId },
      defaults: { courseId, title, description, timeLimit, maxAttempts }
    });

    if (!created) {
      await quiz.update({ title, description, timeLimit, maxAttempts });
    }

    // Delete existing questions and bulk create new ones
    if (questions && Array.isArray(questions)) {
      await EliteQuizQuestion.destroy({ where: { quizId: quiz.quizId } });

      const questionRecords = questions.map(q => ({
        quizId: quiz.quizId,
        order: q.order,
        type: q.type,
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        points: q.points
      }));
      await EliteQuizQuestion.bulkCreate(questionRecords);
    }

    const quizWithQuestions = await EliteCourseQuiz.findByPk(quiz.quizId, {
      include: [{
        model: EliteQuizQuestion, as: 'questions',
        order: [['order', 'ASC']]
      }],
      order: [[{ model: EliteQuizQuestion, as: 'questions' }, 'order', 'ASC']]
    });

    res.json(quizWithQuestions);
  } catch (error) {
    console.error('Error creating/updating quiz:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/elite/courses/:courseId/quiz - Get quiz details
exports.getQuizDetails = async (req, res) => {
  try {
    const { courseId } = req.params;

    const quiz = await EliteCourseQuiz.findOne({
      where: { courseId },
      include: [
        {
          model: EliteQuizQuestion, as: 'questions',
          order: [['order', 'ASC']]
        },
        {
          model: EliteQuizAttempt, as: 'attempts',
          include: [{ model: EliteUser, as: 'eliteUser', attributes: ['firstName', 'lastName', 'uniqueId', 'email'] }]
        }
      ],
      order: [[{ model: EliteQuizQuestion, as: 'questions' }, 'order', 'ASC']]
    });

    if (!quiz) {
      return res.status(404).json({ message: 'No quiz found for this course' });
    }

    res.json(quiz);
  } catch (error) {
    console.error('Error fetching quiz details:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PATCH /api/elite/courses/:courseId/quiz/attempts/:attemptId/grade - Grade written answers
exports.gradeWrittenAnswers = async (req, res) => {
  try {
    const { courseId, attemptId } = req.params;
    const { grades } = req.body;

    const attempt = await EliteQuizAttempt.findByPk(attemptId, {
      include: [{ model: EliteCourseQuiz, as: 'quiz' }]
    });

    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }

    // Update answers with grades
    let answers = attempt.answers || [];
    let totalEarnedPoints = 0;

    for (const grade of grades) {
      const answerIndex = answers.findIndex(a => a.questionId === grade.questionId);
      if (answerIndex !== -1) {
        answers[answerIndex].pointsEarned = grade.pointsEarned;
        answers[answerIndex].isCorrect = grade.isCorrect;
      }
    }

    // Recalculate earned points
    for (const answer of answers) {
      if (answer.pointsEarned !== undefined && answer.pointsEarned !== null) {
        totalEarnedPoints += answer.pointsEarned;
      }
    }

    const score = attempt.totalPoints > 0 ? Math.round((totalEarnedPoints / attempt.totalPoints) * 100) : 0;

    await attempt.update({
      answers,
      earnedPoints: totalEarnedPoints,
      score,
      status: 'graded'
    });

    // Update enrollment
    const enrollment = await EliteCourseEnrollment.findByPk(attempt.enrollmentId);
    if (enrollment) {
      await enrollment.update({ quizScore: score });

      const course = await EliteCourse.findByPk(courseId);
      if (course && score >= course.passingScore && enrollment.progressPercent === 100) {
        await enrollment.update({ status: 'completed', completedAt: new Date() });
      }
    }

    const updatedAttempt = await EliteQuizAttempt.findByPk(attemptId);
    res.json(updatedAttempt);
  } catch (error) {
    console.error('Error grading written answers:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ==================== User-facing endpoints ====================

// GET /api/elite/my-courses - Get my courses
exports.getMyCourses = async (req, res) => {
  try {
    const { eliteId } = req.query;

    if (!eliteId) {
      return res.status(400).json({ message: 'eliteId is required' });
    }

    const enrollments = await EliteCourseEnrollment.findAll({
      where: { eliteId },
      include: [{
        model: EliteCourse, as: 'course',
        attributes: ['courseId', 'title', 'description', 'thumbnail', 'startDate', 'endDate', 'status']
      }],
      order: [['enrolledAt', 'DESC']]
    });

    res.json(enrollments);
  } catch (error) {
    console.error('Error fetching my courses:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/elite/my-courses/:courseId - Get course detail for user
exports.getCourseDetail = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { eliteId } = req.query;

    if (!eliteId) {
      return res.status(400).json({ message: 'eliteId is required' });
    }

    const enrollment = await EliteCourseEnrollment.findOne({
      where: { courseId, eliteId },
      include: [
        {
          model: EliteCourse, as: 'course',
          include: [{
            model: EliteCourseLesson, as: 'lessons',
            order: [['order', 'ASC']]
          }]
        },
        { model: EliteLessonProgress, as: 'lessonProgress' },
        {
          model: EliteQuizAttempt, as: 'quizAttempts'
        }
      ],
      order: [
        [{ model: EliteCourse, as: 'course' }, { model: EliteCourseLesson, as: 'lessons' }, 'order', 'ASC']
      ]
    });

    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }

    // Get quiz without correct answers
    const quiz = await EliteCourseQuiz.findOne({
      where: { courseId },
      include: [{
        model: EliteQuizQuestion, as: 'questions',
        attributes: ['questionId', 'order', 'type', 'questionText', 'options', 'points'],
        order: [['order', 'ASC']]
      }],
      order: [[{ model: EliteQuizQuestion, as: 'questions' }, 'order', 'ASC']]
    });

    // Strip isCorrect from options in questions
    let quizData = null;
    if (quiz) {
      quizData = quiz.toJSON();
      if (quizData.questions) {
        quizData.questions = quizData.questions.map(q => {
          if (q.options && Array.isArray(q.options)) {
            q.options = q.options.map(opt => {
              const { isCorrect, ...rest } = typeof opt === 'object' ? opt : { text: opt };
              return rest;
            });
          }
          return q;
        });
      }
    }

    const result = enrollment.toJSON();
    result.quiz = quizData;

    res.json(result);
  } catch (error) {
    console.error('Error fetching course detail:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PATCH /api/elite/my-courses/:courseId/lessons/:lessonId/complete - Mark lesson complete
exports.markLessonComplete = async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;
    const { eliteId } = req.query;

    if (!eliteId) {
      return res.status(400).json({ message: 'eliteId is required' });
    }

    const enrollment = await EliteCourseEnrollment.findOne({ where: { courseId, eliteId } });
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }

    const [progress, created] = await EliteLessonProgress.findOrCreate({
      where: { enrollmentId: enrollment.enrollmentId, lessonId },
      defaults: { enrollmentId: enrollment.enrollmentId, lessonId, completed: true, completedAt: new Date() }
    });

    if (!created) {
      await progress.update({ completed: true, completedAt: new Date() });
    }

    // Recalculate progress
    const totalLessons = await EliteCourseLesson.count({ where: { courseId } });
    const completedLessons = await EliteLessonProgress.count({
      where: { enrollmentId: enrollment.enrollmentId, completed: true }
    });
    const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    const updateData = { progressPercent, lastAccessedAt: new Date() };
    if (enrollment.status === 'enrolled') {
      updateData.status = 'in_progress';
    }

    await enrollment.update(updateData);

    const updatedEnrollment = await EliteCourseEnrollment.findByPk(enrollment.enrollmentId);

    res.json({ progress, enrollment: updatedEnrollment });
  } catch (error) {
    console.error('Error marking lesson complete:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST /api/elite/my-courses/:courseId/lessons/:lessonId/access - Access lesson
exports.accessLesson = async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;
    const { eliteId } = req.query;

    if (!eliteId) {
      return res.status(400).json({ message: 'eliteId is required' });
    }

    const enrollment = await EliteCourseEnrollment.findOne({ where: { courseId, eliteId } });
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }

    const [progress, created] = await EliteLessonProgress.findOrCreate({
      where: { enrollmentId: enrollment.enrollmentId, lessonId },
      defaults: { enrollmentId: enrollment.enrollmentId, lessonId, accessedAt: new Date() }
    });

    if (!created) {
      await progress.update({ accessedAt: new Date() });
    }

    const updateData = { lastAccessedAt: new Date() };
    if (enrollment.status === 'enrolled') {
      updateData.status = 'in_progress';
    }
    await enrollment.update(updateData);

    res.json({ message: 'OK' });
  } catch (error) {
    console.error('Error accessing lesson:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST /api/elite/my-courses/:courseId/quiz/start - Start quiz
exports.startQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { eliteId } = req.query;

    if (!eliteId) {
      return res.status(400).json({ message: 'eliteId is required' });
    }

    const quiz = await EliteCourseQuiz.findOne({
      where: { courseId },
      include: [{
        model: EliteQuizQuestion, as: 'questions',
        order: [['order', 'ASC']]
      }],
      order: [[{ model: EliteQuizQuestion, as: 'questions' }, 'order', 'ASC']]
    });

    if (!quiz) {
      return res.status(404).json({ message: 'No quiz found for this course' });
    }

    const enrollment = await EliteCourseEnrollment.findOne({ where: { courseId, eliteId } });
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }

    if (enrollment.progressPercent !== 100) {
      return res.status(400).json({ message: 'You must complete all lessons before taking the quiz' });
    }

    // Check max attempts
    const attemptCount = await EliteQuizAttempt.count({
      where: { quizId: quiz.quizId, eliteId }
    });

    if (attemptCount >= quiz.maxAttempts) {
      return res.status(400).json({ message: 'Maximum number of attempts reached' });
    }

    // Calculate total points
    const totalPoints = quiz.questions.reduce((sum, q) => sum + q.points, 0);

    const attempt = await EliteQuizAttempt.create({
      quizId: quiz.quizId,
      eliteId,
      enrollmentId: enrollment.enrollmentId,
      totalPoints,
      startedAt: new Date()
    });

    // Return questions without correct answers
    const questions = quiz.questions.map(q => {
      const questionData = q.toJSON();
      delete questionData.correctAnswer;
      if (questionData.options && Array.isArray(questionData.options)) {
        questionData.options = questionData.options.map(opt => {
          if (typeof opt === 'object') {
            const { isCorrect, ...rest } = opt;
            return rest;
          }
          return opt;
        });
      }
      return questionData;
    });

    res.status(201).json({ attempt, questions });
  } catch (error) {
    console.error('Error starting quiz:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST /api/elite/my-courses/:courseId/quiz/submit - Submit quiz
exports.submitQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { attemptId, eliteId, answers } = req.body;

    const attempt = await EliteQuizAttempt.findByPk(attemptId);
    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }

    if (attempt.status !== 'in_progress') {
      return res.status(400).json({ message: 'This attempt has already been submitted' });
    }

    // Get quiz questions
    const questions = await EliteQuizQuestion.findAll({
      where: { quizId: attempt.quizId }
    });

    const questionsMap = {};
    questions.forEach(q => { questionsMap[q.questionId] = q; });

    let earnedPoints = 0;
    let hasWrittenQuestions = false;

    const gradedAnswers = answers.map(answer => {
      const question = questionsMap[answer.questionId];
      if (!question) return answer;

      const result = {
        questionId: answer.questionId,
        answer: answer.answer,
        selectedOption: answer.selectedOption,
        points: question.points
      };

      if (question.type === 'mcq') {
        // Auto-grade MCQ: compare selectedOption with correct option
        const isCorrect = answer.selectedOption !== undefined && answer.selectedOption !== null &&
          String(answer.selectedOption) === String(question.correctAnswer);
        result.isCorrect = isCorrect;
        result.pointsEarned = isCorrect ? question.points : 0;
        if (isCorrect) earnedPoints += question.points;
      } else {
        // Written question - pending review
        result.isCorrect = null;
        result.pointsEarned = null;
        hasWrittenQuestions = true;
      }

      return result;
    });

    const updateData = {
      answers: gradedAnswers,
      submittedAt: new Date(),
      earnedPoints
    };

    if (!hasWrittenQuestions) {
      updateData.status = 'graded';
      updateData.score = attempt.totalPoints > 0 ? Math.round((earnedPoints / attempt.totalPoints) * 100) : 0;
    } else {
      updateData.status = 'submitted';
    }

    await attempt.update(updateData);

    // Update enrollment quiz score
    const enrollment = await EliteCourseEnrollment.findByPk(attempt.enrollmentId);
    if (enrollment) {
      const enrollmentUpdate = { quizScore: updateData.score || null };

      if (!hasWrittenQuestions && updateData.score !== undefined) {
        const course = await EliteCourse.findByPk(courseId);
        if (course && updateData.score >= course.passingScore && enrollment.progressPercent === 100) {
          enrollmentUpdate.status = 'completed';
          enrollmentUpdate.completedAt = new Date();
        }
      }

      await enrollment.update(enrollmentUpdate);
    }

    const updatedAttempt = await EliteQuizAttempt.findByPk(attemptId);
    res.json(updatedAttempt);
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/elite/my-courses/:courseId/quiz/result - Get quiz result
exports.getQuizResult = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { eliteId } = req.query;

    if (!eliteId) {
      return res.status(400).json({ message: 'eliteId is required' });
    }

    const quiz = await EliteCourseQuiz.findOne({ where: { courseId } });
    if (!quiz) {
      return res.status(404).json({ message: 'No quiz found for this course' });
    }

    const attempt = await EliteQuizAttempt.findOne({
      where: { quizId: quiz.quizId, eliteId },
      order: [['createdAt', 'DESC']],
      include: [{ model: EliteCourseQuiz, as: 'quiz', attributes: ['title'] }]
    });

    if (!attempt) {
      return res.status(404).json({ message: 'No quiz attempt found' });
    }

    res.json(attempt);
  } catch (error) {
    console.error('Error fetching quiz result:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
