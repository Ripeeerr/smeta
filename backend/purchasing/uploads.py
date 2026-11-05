from django.core.files.uploadhandler import FileUploadHandler, StopUpload


class LimitedFileUploadHandler(FileUploadHandler):
    max_file_size = 10 * 1024 * 1024
    max_total_size = 12 * 1024 * 1024

    def __init__(self, request=None):
        super().__init__(request)
        self.total_bytes = 0
        self.file_bytes = 0

    def new_file(self, *args, **kwargs):
        super().new_file(*args, **kwargs)
        self.file_bytes = 0

    def receive_data_chunk(self, raw_data, start):
        self.file_bytes += len(raw_data)
        self.total_bytes += len(raw_data)
        if self.file_bytes > self.max_file_size or self.total_bytes > self.max_total_size:
            self.request.upload_limit_exceeded = True
            raise StopUpload(connection_reset=False)
        return raw_data

    def file_complete(self, file_size):
        return None
