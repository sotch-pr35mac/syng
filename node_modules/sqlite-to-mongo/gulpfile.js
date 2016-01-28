var gulp = require('gulp');
var jasmine = require('gulp-jasmine');

gulp.task('default', ['watch']);

gulp.task('test', function () {
  return gulp.src('spec/test.js')
    .pipe(jasmine());
});

gulp.task('watch', function () {
  gulp.watch('lib/**/*.js', ['test']);
  gulp.watch('spec/**/*.js', ['test']);
});