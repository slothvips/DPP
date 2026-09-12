FROM jenkins/jenkins:lts-jdk17

COPY casc.yaml /usr/share/jenkins/ref/casc.yaml
ENV CASC_JENKINS_CONFIG=/usr/share/jenkins/ref/casc.yaml

RUN jenkins-plugin-cli --plugins \
    configuration-as-code \
    job-dsl \
    workflow-cps \
    workflow-job \
    workflow-multibranch \
    workflow-basic-steps \
    workflow-durable-task-step \
    pipeline-model-definition \
    pipeline-stage-view \
    cloudbees-folder \
    junit \
    git
