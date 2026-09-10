FROM golang:1.26.8

WORKDIR /app
ADD . /app
RUN go mod tidy

CMD ["sleep", "infinity"]
