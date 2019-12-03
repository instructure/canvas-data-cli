#! /usr/bin/env groovy

def sendSlack(success) {
  status = success ? "passed" : "failed"
  color  = success ? "good"   : "bad"
  short_job_name = env.JOB_NAME.replaceAll(/.*\//, "");
  message = "[$short_job_name] <$env.GERRIT_CHANGE_URL|$env.GERRIT_CHANGE_SUBJECT> *$status* <$env.BUILD_URL|New Jenkins>."
  slackSend channel: '#pandalytics-cr', color: color, message: message
}

pipeline {
  agent { label "docker" }

  options {
    ansiColor('xterm')
  }

  stages {
    stage('Tests') {
      parallel {
        stage('Unit Tests') {
          steps {
            sh "./build.sh"
          }
        }
      }
    }
  }
  post {
    failure {
      sendSlack(false)
    }
    success {
      sendSlack(true)
    }
  }
}
