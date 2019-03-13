const gulp = require('gulp');
const ts = require('gulp-typescript');
const path = require('path');

gulp.task('server', () => {
  const tsProject = ts.createProject('./server/tsconfig.json');
  const tsResult = gulp.src('./server/src/**/*.ts').pipe(tsProject());
  return tsResult.js.pipe(gulp.dest('./dist/server'));
});
gulp.task('themes', () => {
  return gulp.src('./themes/**/*')
    .pipe(gulp.dest('./dist/themes'));
})
gulp.task('watch', function () {
  gulp.watch('./themes/**/*', gulp.series(['themes']));
  gulp.watch('./server/**/*', gulp.series(['server']));
});
